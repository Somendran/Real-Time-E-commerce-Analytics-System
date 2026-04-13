from __future__ import annotations

from pathlib import Path

import pandas as pd

from config import BASE_DIR, ORDERS_CLEAN_PATH, RAW_DATA_DIR, RAW_FILES


def _resolve_raw_file(filename: str) -> Path:
    """Resolve raw CSV path from data/raw first, then project root as fallback."""
    preferred = RAW_DATA_DIR / filename
    if preferred.exists():
        return preferred

    fallback = BASE_DIR / filename
    if fallback.exists():
        return fallback

    raise FileNotFoundError(f"Required input file not found: {filename}")


def _load_raw_data() -> dict[str, pd.DataFrame]:
    dataframes: dict[str, pd.DataFrame] = {}
    for name, filename in RAW_FILES.items():
        path = _resolve_raw_file(filename)
        dataframes[name] = pd.read_csv(path)
    return dataframes


def prepare_orders_dataset(output_path: Path = ORDERS_CLEAN_PATH) -> Path:
    """Build a clean, analysis-ready orders dataset and save to CSV."""
    data = _load_raw_data()

    orders = data["orders"].copy()
    order_items = data["order_items"].copy()
    payments = data["payments"].copy()
    reviews = data["reviews"].copy()
    products = data["products"].copy()
    customers = data["customers"].copy()
    translations = data["translations"].copy()

    payments_agg = (
        payments.groupby("order_id", as_index=False)["payment_value"]
        .sum()
        .rename(columns={"payment_value": "payment_value"})
    )

    reviews_agg = (
        reviews.groupby("order_id", as_index=False)["review_score"]
        .mean()
        .round(0)
    )

    products_with_translation = products.merge(
        translations,
        on="product_category_name",
        how="left",
    )

    unified = (
        orders.merge(order_items[["order_id", "product_id", "price", "freight_value"]], on="order_id", how="inner")
        .merge(products_with_translation[["product_id", "product_category_name_english"]], on="product_id", how="left")
        .merge(payments_agg[["order_id", "payment_value"]], on="order_id", how="left")
        .merge(reviews_agg[["order_id", "review_score"]], on="order_id", how="left")
        .merge(customers[["customer_id", "customer_city", "customer_state"]], on="customer_id", how="left")
    )

    unified = unified.rename(
        columns={
            "order_purchase_timestamp": "order_date",
            "product_category_name_english": "product_category_name",
        }
    )

    columns = [
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

    missing_columns = [col for col in columns if col not in unified.columns]
    if missing_columns:
        raise ValueError(f"Missing expected columns after join: {missing_columns}")

    clean_df = unified[columns].copy()

    clean_df["order_date"] = pd.to_datetime(clean_df["order_date"], errors="coerce", utc=False)

    for numeric_col in ["price", "freight_value", "payment_value"]:
        clean_df[numeric_col] = pd.to_numeric(clean_df[numeric_col], errors="coerce").fillna(0.0)

    clean_df["review_score"] = pd.to_numeric(clean_df["review_score"], errors="coerce")
    if clean_df["review_score"].notna().any():
        clean_df["review_score"] = clean_df["review_score"].fillna(clean_df["review_score"].median())
    else:
        clean_df["review_score"] = clean_df["review_score"].fillna(0)
    clean_df["review_score"] = clean_df["review_score"].round(0).astype(int)

    clean_df["product_category_name"] = clean_df["product_category_name"].fillna("unknown")
    clean_df["customer_city"] = clean_df["customer_city"].fillna("unknown")
    clean_df["customer_state"] = clean_df["customer_state"].fillna("unknown")

    clean_df = clean_df.dropna(subset=["order_id", "customer_id", "product_id", "order_date"])
    clean_df = clean_df.drop_duplicates(subset=["order_id", "customer_id", "product_id", "order_date"])
    clean_df = clean_df.sort_values("order_date").reset_index(drop=True)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    clean_df.to_csv(output_path, index=False)
    return output_path


if __name__ == "__main__":
    path = prepare_orders_dataset()
    print(f"Prepared clean dataset at: {path}")
