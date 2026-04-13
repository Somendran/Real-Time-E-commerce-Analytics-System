from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
import psycopg2

from config import BATCH_DIR, DB_URL, ORDERS_CLEAN_PATH


def _extract_batch_index(batch_file: Path) -> int:
    """Extract numeric index from batch file name like batch_12.csv."""
    match = re.fullmatch(r"batch_(\d+)\.csv", batch_file.name)
    if not match:
        raise ValueError(f"Invalid batch filename format: {batch_file.name}")
    return int(match.group(1))


def _get_sorted_batch_files(batch_dir: Path) -> list[tuple[int, Path]]:
    """Return batch files sorted numerically by index and validate sequence continuity."""
    raw_batch_files = list(batch_dir.glob("batch_*.csv"))
    if not raw_batch_files:
        raise FileNotFoundError(f"No batch files found in: {batch_dir}")

    indexed_files = [(_extract_batch_index(path), path) for path in raw_batch_files]
    indexed_files.sort(key=lambda item: item[0])

    # Ensure indices are continuous (e.g., 0,1,2,3...) and no files are missing.
    expected_indices = list(range(indexed_files[0][0], indexed_files[0][0] + len(indexed_files)))
    actual_indices = [idx for idx, _ in indexed_files]
    if actual_indices != expected_indices:
        raise ValueError(
            "Missing or out-of-sequence batch files detected. "
            f"Found indices={actual_indices}, expected contiguous indices={expected_indices}"
        )

    return indexed_files


def validate_orders_clean(orders_clean_path: Path = ORDERS_CLEAN_PATH) -> bool:
    """
    Validate the unified clean dataset:
    - file exists
    - no null order_id
    - order_date is parseable datetime
    - no duplicate primary-key-like rows
    """
    if not orders_clean_path.exists():
        raise FileNotFoundError(f"orders_clean file not found: {orders_clean_path}")

    df = pd.read_csv(orders_clean_path)
    if df.empty:
        raise ValueError("orders_clean.csv is empty.")

    if "order_id" not in df.columns:
        raise ValueError("orders_clean.csv is missing required column: order_id")

    null_order_ids = int(df["order_id"].isna().sum())
    if null_order_ids > 0:
        raise ValueError(f"orders_clean.csv has {null_order_ids} null order_id values.")

    if "order_date" not in df.columns:
        raise ValueError("orders_clean.csv is missing required column: order_date")

    order_dates = pd.to_datetime(df["order_date"], errors="coerce")
    invalid_dates = int(order_dates.isna().sum())
    if invalid_dates > 0:
        raise ValueError(f"orders_clean.csv has {invalid_dates} invalid order_date values.")

    duplicate_count = int(
        df.duplicated(subset=["order_id", "product_id", "order_date"]).sum()
    )
    if duplicate_count > 0:
        raise ValueError(
            "orders_clean.csv has duplicate rows for (order_id, product_id, order_date): "
            f"{duplicate_count}"
        )

    return True


def validate_batches(
    batch_dir: Path = BATCH_DIR,
    source_path: Path = ORDERS_CLEAN_PATH,
    expected_batch_size: int = 1000,
) -> bool:
    """
    Validate generated batch files:
    - at least one batch exists
    - each non-final batch has expected size
    - total rows across batches equals source dataset rows
    """
    if expected_batch_size <= 0:
        raise ValueError("expected_batch_size must be greater than 0")

    if not source_path.exists():
        raise FileNotFoundError(f"Source clean dataset not found: {source_path}")

    source_df = pd.read_csv(source_path)
    source_rows = len(source_df)

    indexed_batch_files = _get_sorted_batch_files(batch_dir)

    total_batch_rows = 0
    last_batch_size = 0
    total_batches = len(indexed_batch_files)

    for position, (batch_index, batch_file) in enumerate(indexed_batch_files):
        batch_df = pd.read_csv(batch_file)
        batch_rows = len(batch_df)

        if batch_rows == 0:
            raise ValueError(f"Empty batch file found: {batch_file.name}")

        total_batch_rows += batch_rows
        last_batch_size = batch_rows

        is_last = position == total_batches - 1

        # Every non-final batch must match expected size exactly.
        if not is_last and batch_rows != expected_batch_size:
            raise ValueError(
                f"Batch size mismatch in {batch_file.name}: "
                f"expected {expected_batch_size}, got {batch_rows}"
            )

        # Final batch can be smaller, but cannot exceed expected size.
        if is_last and batch_rows > expected_batch_size:
            raise ValueError(
                f"Final batch exceeds expected size in {batch_file.name}: "
                f"expected <= {expected_batch_size}, got {batch_rows}"
            )

        # Additional consistency check: index should reflect position after numeric sort.
        if batch_index != position:
            raise ValueError(
                "Batch ordering/index mismatch detected. "
                f"Expected batch_{position}.csv at position {position}, found {batch_file.name}"
            )

    if total_batch_rows != source_rows:
        raise ValueError(
            "Total batch rows do not match source rows: "
            f"batches={total_batch_rows}, source={source_rows}"
        )

    print(f"Total batches: {total_batches}")
    print(f"Total rows across batches: {total_batch_rows}")
    print(f"Last batch size: {last_batch_size}")
    print("Batch validation: PASSED")

    return True


def validate_database_insert(db_url: str | None = DB_URL) -> tuple[int, int]:
    """
    Validate rows in database:
    - print and return total row count in orders_clean
    - confirm no duplicate primary key combinations
    """
    if not db_url:
        raise EnvironmentError("Database URL is missing for database validation.")

    try:
        with psycopg2.connect(db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM orders_clean;")
                row_count = int(cur.fetchone()[0])

                cur.execute(
                    """
                    SELECT COUNT(*)
                    FROM (
                        SELECT order_id, product_id, order_date, COUNT(*) AS c
                        FROM orders_clean
                        GROUP BY order_id, product_id, order_date
                        HAVING COUNT(*) > 1
                    ) dup;
                    """
                )
                duplicate_pk_count = int(cur.fetchone()[0])
    except psycopg2.Error as exc:
        raise ConnectionError(f"Database validation failed: {exc}") from exc

    print(f"Database row count in orders_clean: {row_count}")
    if duplicate_pk_count == 0:
        print("Duplicate primary keys check: PASSED")
    else:
        print(f"Duplicate primary keys check: FAILED ({duplicate_pk_count} duplicates)")

    return row_count, duplicate_pk_count