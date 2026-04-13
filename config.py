from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
BATCH_DIR = BASE_DIR / "data_batches"
PIPELINE_STATE_FILE = BASE_DIR / "current_batch.txt"
ORDERS_CLEAN_PATH = DATA_DIR / "orders_clean.csv"

# Load variables from .env if present.
load_dotenv(BASE_DIR / ".env")

DB_URL = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL")

# Required source files for the unified orders dataset.
RAW_FILES = {
    "orders": "olist_orders_dataset.csv",
    "order_items": "olist_order_items_dataset.csv",
    "payments": "olist_order_payments_dataset.csv",
    "reviews": "olist_order_reviews_dataset.csv",
    "products": "olist_products_dataset.csv",
    "customers": "olist_customers_dataset.csv",
    "translations": "product_category_name_translation.csv",
}
