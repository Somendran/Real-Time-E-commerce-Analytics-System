from __future__ import annotations

import time
from pathlib import Path
from typing import Iterable

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

from config import BATCH_DIR, DB_URL
from pipeline.tracker import get_current_batch, update_current_batch


def _validate_db_url() -> str:
    if not DB_URL:
        raise EnvironmentError(
            "Database connection URL is missing. Set SUPABASE_DB_URL or DATABASE_URL."
        )
    return DB_URL


def get_connection():
    try:
        return psycopg2.connect(_validate_db_url())
    except psycopg2.Error as exc:
        raise ConnectionError(f"Failed to connect to PostgreSQL: {exc}") from exc


def create_orders_table() -> None:
    create_sql = """
    CREATE TABLE IF NOT EXISTS orders_clean (
        order_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        order_date TIMESTAMP NOT NULL,
        price NUMERIC(12,2) NOT NULL,
        freight_value NUMERIC(12,2) NOT NULL,
        payment_value NUMERIC(12,2) NOT NULL,
        review_score INTEGER NOT NULL,
        product_category_name TEXT NOT NULL,
        customer_city TEXT NOT NULL,
        customer_state TEXT NOT NULL,
        PRIMARY KEY (order_id, product_id, order_date)
    );
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(create_sql)
            conn.commit()
    except psycopg2.Error as exc:
        raise ConnectionError(f"Failed to create orders_clean table: {exc}") from exc


def _prepare_batch_rows(batch_df: pd.DataFrame) -> Iterable[tuple]:
    required = [
        "order_id",
        "customer_id",
        "product_id",
        "order_date",
        "price",
        "freight_value",
        "payment_value",
        "review_score",
        "product_category_name",
        "customer_city",
        "customer_state",
    ]

    missing_cols = [col for col in required if col not in batch_df.columns]
    if missing_cols:
        raise ValueError(f"Batch missing required columns: {missing_cols}")

    df = batch_df[required].copy()
    df["order_date"] = pd.to_datetime(df["order_date"], errors="coerce")
    df = df.dropna(subset=["order_date", "order_id", "customer_id", "product_id"])

    for col in ["price", "freight_value", "payment_value"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    df["review_score"] = pd.to_numeric(df["review_score"], errors="coerce").fillna(0).astype(int)

    for col in ["product_category_name", "customer_city", "customer_state"]:
        df[col] = df[col].fillna("unknown")

    return list(df.itertuples(index=False, name=None))


def bulk_insert_batch(batch_df: pd.DataFrame) -> int:
    """Insert a batch into PostgreSQL using upsert to avoid duplicate primary keys."""
    rows = _prepare_batch_rows(batch_df)
    if not rows:
        raise ValueError("Batch has no valid rows to insert after preprocessing.")

    insert_sql = """
    INSERT INTO orders_clean (
        order_id,
        customer_id,
        product_id,
        order_date,
        price,
        freight_value,
        payment_value,
        review_score,
        product_category_name,
        customer_city,
        customer_state
    ) VALUES %s
    ON CONFLICT (order_id, product_id, order_date)
    DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        price = EXCLUDED.price,
        freight_value = EXCLUDED.freight_value,
        payment_value = EXCLUDED.payment_value,
        review_score = EXCLUDED.review_score,
        product_category_name = EXCLUDED.product_category_name,
        customer_city = EXCLUDED.customer_city,
        customer_state = EXCLUDED.customer_state;
    """

    start_time = time.perf_counter()

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                execute_values(cursor, insert_sql, rows, page_size=1000)
            conn.commit()
    except psycopg2.Error as exc:
        raise RuntimeError(f"Bulk insert failed: {exc}") from exc

    elapsed_seconds = time.perf_counter() - start_time
    print(f"Rows inserted/upserted: {len(rows)}")
    print(f"Insert time: {elapsed_seconds:.3f} seconds")

    return len(rows)


def load_batch(batch_idx: int, batch_dir: Path = BATCH_DIR, dry_run: bool = False) -> int:
    """Load a specific batch index into PostgreSQL, or print a dry-run summary."""
    batch_file = batch_dir / f"batch_{batch_idx}.csv"

    if not batch_file.exists():
        raise FileNotFoundError(f"Batch file not found: {batch_file}")

    batch_df = pd.read_csv(batch_file)
    if batch_df.empty:
        raise ValueError(f"Batch file is empty: {batch_file.name}")

    if dry_run:
        print(f"[DRY RUN] Would insert batch file: {batch_file.name}")
        print(f"[DRY RUN] Rows to insert: {len(batch_df)}")
        return len(batch_df)

    create_orders_table()
    return bulk_insert_batch(batch_df)


def run_pipeline(batch_dir: Path = BATCH_DIR) -> str:
    """
    Process one batch per run:
    1) Read current batch pointer
    2) Load batch CSV
    3) Insert/upsert into PostgreSQL
    4) Advance batch pointer
    """
    batch_idx = get_current_batch()
    batch_file = batch_dir / f"batch_{batch_idx}.csv"

    if not batch_file.exists():
        return f"No batch found for index {batch_idx}. Pipeline is up to date."

    inserted = load_batch(batch_idx=batch_idx, batch_dir=batch_dir, dry_run=False)
    update_current_batch(batch_idx + 1)

    return f"Processed batch_{batch_idx}.csv ({inserted} rows upserted)."


if __name__ == "__main__":
    result = run_pipeline()
    print(result)
