from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.db import fetch_all, fetch_one
from backend.ml import detect_anomalies, predict_next_day

router = APIRouter(tags=["analytics"])


@router.get("/metrics")
def get_metrics():
    query = """
    SELECT
        COUNT(*)::BIGINT AS total_orders,
        COALESCE(SUM(payment_value), 0)::NUMERIC AS total_revenue
    FROM orders_clean;
    """
    try:
        result = fetch_one(query)
        return {
            "data": {
                "total_orders": int(result.get("total_orders", 0)),
                "total_revenue": float(result.get("total_revenue", 0)),
            }
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch metrics: {exc}") from exc


@router.get("/daily-revenue")
def get_daily_revenue():
    query = """
    SELECT
        DATE(order_date) AS date,
        COALESCE(SUM(payment_value), 0)::NUMERIC AS total_revenue
    FROM orders_clean
    GROUP BY DATE(order_date)
    ORDER BY DATE(order_date);
    """
    try:
        rows = fetch_all(query)
        return {
            "data": [
                {
                    "date": row["date"].isoformat(),
                    "total_revenue": float(row["total_revenue"]),
                }
                for row in rows
            ]
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch daily revenue: {exc}") from exc


@router.get("/daily-orders")
def get_daily_orders():
    query = """
    SELECT
        DATE(order_date) AS date,
        COUNT(*)::BIGINT AS order_count
    FROM orders_clean
    GROUP BY DATE(order_date)
    ORDER BY DATE(order_date);
    """
    try:
        rows = fetch_all(query)
        return {
            "data": [
                {
                    "date": row["date"].isoformat(),
                    "order_count": int(row["order_count"]),
                }
                for row in rows
            ]
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch daily orders: {exc}") from exc


@router.get("/data-growth")
def get_data_growth():
    query = """
    WITH daily_counts AS (
        SELECT
            DATE(order_date) AS date,
            COUNT(*)::BIGINT AS daily_count
        FROM orders_clean
        GROUP BY DATE(order_date)
    )
    SELECT
        date,
        SUM(daily_count) OVER (ORDER BY date)::BIGINT AS cumulative_orders
    FROM daily_counts
    ORDER BY date;
    """
    try:
        rows = fetch_all(query)
        return {
            "data": [
                {
                    "date": row["date"].isoformat(),
                    "cumulative_orders": int(row["cumulative_orders"]),
                }
                for row in rows
            ]
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch data growth: {exc}") from exc


@router.get("/prediction", response_model=None)
def get_prediction():
    """Return next-day revenue prediction from the ML module."""
    print("Prediction endpoint hit")
    try:
        return predict_next_day()
    except Exception as exc:
        return {"error": str(exc)}


@router.get("/anomalies", response_model=None)
def get_anomalies():
    """Return detected revenue anomalies from the ML module."""
    print("Anomalies endpoint hit")
    try:
        return detect_anomalies()
    except Exception as exc:
        return {"error": str(exc)}
