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
