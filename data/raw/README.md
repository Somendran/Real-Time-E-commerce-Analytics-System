# Raw Data

Place the Olist source CSV files in this folder before running the data pipeline.

The full raw dataset is intentionally not committed because it is large. Download it from Kaggle:

Brazilian E-Commerce Public Dataset by Olist

Required files for the current pipeline:

- `olist_orders_dataset.csv`
- `olist_order_items_dataset.csv`
- `olist_order_payments_dataset.csv`
- `olist_order_reviews_dataset.csv`
- `olist_products_dataset.csv`
- `olist_customers_dataset.csv`
- `product_category_name_translation.csv`

The pipeline resolves files from `data/raw` first and falls back to the project root only for legacy local setups.
