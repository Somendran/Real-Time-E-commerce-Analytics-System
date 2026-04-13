from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend.advanced_analytics import (
    calculate_anomaly_root_cause,
    calculate_churn_risk,
    calculate_cohort_retention,
    calculate_customer_ltv,
    calculate_revenue_decomposition,
    fetch_orders_clean_dataframe,
)
from backend.db import fetch_all, fetch_one
from backend.ml import (
    detect_anomalies,
    explain_next_day_prediction,
    load_model_metrics,
    predict_next_day,
    train_and_save_model,
)

router = APIRouter(tags=["analytics"])


SEGMENT_ORDER = {"High": 0, "Medium": 1, "Low": 2}
FilterParams = tuple[str | None, str | None, str | None, str | None, float | None, float | None]


def _build_filter_clause(
    start_date: str | None = None,
    end_date: str | None = None,
    category: str | None = None,
    state: str | None = None,
    min_revenue: float | None = None,
    max_revenue: float | None = None,
) -> tuple[str, tuple[object, ...]]:
    clauses: list[str] = []
    params: list[object] = []

    if start_date:
        clauses.append("order_date::date >= %s")
        params.append(start_date)
    if end_date:
        clauses.append("order_date::date <= %s")
        params.append(end_date)
    if category:
        clauses.append("product_category_name = %s")
        params.append(category)
    if state:
        clauses.append("customer_state = %s")
        params.append(state)
    if min_revenue is not None:
        clauses.append("payment_value >= %s")
        params.append(min_revenue)
    if max_revenue is not None:
        clauses.append("payment_value <= %s")
        params.append(max_revenue)

    if not clauses:
        return "", ()

    return "WHERE " + " AND ".join(clauses), tuple(params)


def _get_bi_signal_context(
    start_date: str | None = None,
    end_date: str | None = None,
    category: str | None = None,
    state: str | None = None,
    min_revenue: float | None = None,
    max_revenue: float | None = None,
) -> dict[str, object]:
    """Fetch compact aggregate signals used by insights and recommendations."""
    where_clause, params = _build_filter_clause(
        start_date, end_date, category, state, min_revenue, max_revenue
    )
    revenue_trend = fetch_one(
        f"""
        WITH daily_revenue AS (
            SELECT
                DATE(order_date) AS date,
                COALESCE(SUM(payment_value), 0)::NUMERIC AS revenue
            FROM orders_clean
            {where_clause}
            GROUP BY DATE(order_date)
        ),
        ranked_revenue AS (
            SELECT
                date,
                revenue,
                ROW_NUMBER() OVER (ORDER BY date DESC) AS recency_rank
            FROM daily_revenue
        )
        SELECT
            COALESCE(AVG(revenue) FILTER (WHERE recency_rank BETWEEN 1 AND 7), 0)::NUMERIC AS last_7_avg,
            COALESCE(AVG(revenue) FILTER (WHERE recency_rank BETWEEN 8 AND 14), 0)::NUMERIC AS previous_7_avg
        FROM ranked_revenue;
        """,
        params,
    )

    weekday_mix = fetch_one(
        f"""
        SELECT
            COALESCE(AVG(payment_value) FILTER (WHERE EXTRACT(DOW FROM order_date) IN (0, 6)), 0)::NUMERIC
                AS weekend_avg,
            COALESCE(AVG(payment_value) FILTER (WHERE EXTRACT(DOW FROM order_date) BETWEEN 1 AND 5), 0)::NUMERIC
                AS weekday_avg
        FROM orders_clean;
        """.replace("FROM orders_clean;", f"FROM orders_clean {where_clause};"),
        params,
    )

    top_category = fetch_one(
        f"""
        WITH category_revenue AS (
            SELECT
                product_category_name,
                COALESCE(SUM(payment_value), 0)::NUMERIC AS revenue
            FROM orders_clean
            {where_clause}
            GROUP BY product_category_name
        ),
        total_revenue AS (
            SELECT COALESCE(SUM(revenue), 0)::NUMERIC AS revenue FROM category_revenue
        )
        SELECT
            category_revenue.product_category_name,
            category_revenue.revenue,
            total_revenue.revenue AS total_revenue,
            CASE
                WHEN total_revenue.revenue = 0 THEN 0
                ELSE category_revenue.revenue / total_revenue.revenue
            END::NUMERIC AS revenue_share
        FROM category_revenue
        CROSS JOIN total_revenue
        ORDER BY category_revenue.revenue DESC
        LIMIT 1;
        """,
        params,
    )

    anomaly_summary = fetch_one(
        f"""
        WITH daily_revenue AS (
            SELECT
                DATE(order_date) AS date,
                COALESCE(SUM(payment_value), 0)::NUMERIC AS revenue
            FROM orders_clean
            {where_clause}
            GROUP BY DATE(order_date)
        ),
        scored AS (
            SELECT
                date,
                revenue,
                CASE
                    WHEN STDDEV_POP(revenue) OVER () = 0 THEN 0
                    ELSE (revenue - AVG(revenue) OVER ()) / STDDEV_POP(revenue) OVER ()
                END AS z_score
            FROM daily_revenue
        )
        SELECT COUNT(*)::BIGINT AS anomaly_count
        FROM scored
        WHERE ABS(z_score) > 2.5;
        """,
        params,
    )

    return {
        "last_7_avg": float(revenue_trend.get("last_7_avg", 0) or 0),
        "previous_7_avg": float(revenue_trend.get("previous_7_avg", 0) or 0),
        "weekend_avg": float(weekday_mix.get("weekend_avg", 0) or 0),
        "weekday_avg": float(weekday_mix.get("weekday_avg", 0) or 0),
        "top_category": top_category.get("product_category_name") or "Unknown",
        "top_category_share": float(top_category.get("revenue_share", 0) or 0),
        "anomaly_count": int(anomaly_summary.get("anomaly_count", 0) or 0),
    }


def _build_business_insights(
    start_date: str | None = None,
    end_date: str | None = None,
    category: str | None = None,
    state: str | None = None,
    min_revenue: float | None = None,
    max_revenue: float | None = None,
) -> list[str]:
    context = _get_bi_signal_context(
        start_date, end_date, category, state, min_revenue, max_revenue
    )
    insights: list[str] = []

    last_7_avg = float(context["last_7_avg"])
    previous_7_avg = float(context["previous_7_avg"])
    weekend_avg = float(context["weekend_avg"])
    weekday_avg = float(context["weekday_avg"])
    top_category = str(context["top_category"])
    top_category_share = float(context["top_category_share"])
    anomaly_count = int(context["anomaly_count"])

    if last_7_avg > previous_7_avg and previous_7_avg > 0:
        insights.append("Revenue is trending upward 📈")
    elif previous_7_avg > last_7_avg and last_7_avg > 0:
        insights.append("Revenue is trending downward ⚠️")
    else:
        insights.append("Revenue is broadly stable")

    if weekend_avg > weekday_avg and weekday_avg > 0:
        insights.append("Weekend sales are higher than weekday sales")
    elif weekday_avg > weekend_avg and weekend_avg > 0:
        insights.append("Weekday sales outperform weekends")

    if top_category_share >= 0.25:
        insights.append(f"{top_category} contributes the largest revenue share")
    elif top_category != "Unknown":
        insights.append(f"{top_category} is the top revenue category")

    if anomaly_count > 0:
        insights.append(f"{anomaly_count} revenue anomalies need review ⚠️")

    return insights


def _build_business_recommendations(insights: list[str]) -> list[str]:
    recommendations: list[str] = []
    insight_text = " ".join(insights).lower()

    if "weekend sales are higher" in insight_text:
        recommendations.append("Focus promotions and ad spend on weekends")
    elif "weekday sales outperform" in insight_text:
        recommendations.append("Prioritize weekday campaigns and operational coverage")

    if "top revenue category" in insight_text or "largest revenue share" in insight_text:
        recommendations.append("Expand inventory and merchandising around top-performing categories")

    if "anomalies need review" in insight_text:
        recommendations.append("Investigate revenue anomalies before scaling campaigns")

    if "trending downward" in insight_text:
        recommendations.append("Review recent pricing, stock availability, and campaign performance")
    elif "trending upward" in insight_text:
        recommendations.append("Protect current growth by monitoring fulfillment capacity and stock levels")

    if not recommendations:
        recommendations.append("Continue monitoring revenue, category mix, and anomaly signals")

    return recommendations


@router.get("/metrics")
def get_metrics(
    start_date: str | None = None,
    end_date: str | None = None,
    category: str | None = None,
    state: str | None = None,
    min_revenue: float | None = None,
    max_revenue: float | None = None,
):
    where_clause, params = _build_filter_clause(
        start_date, end_date, category, state, min_revenue, max_revenue
    )
    query = f"""
    SELECT
        COUNT(*)::BIGINT AS total_orders,
        COALESCE(SUM(payment_value), 0)::NUMERIC AS total_revenue
    FROM orders_clean
    {where_clause};
    """
    try:
        result = fetch_one(query, params)
        return {
            "data": {
                "total_orders": int(result.get("total_orders", 0)),
                "total_revenue": float(result.get("total_revenue", 0)),
            }
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch metrics: {exc}") from exc


@router.get("/daily-revenue")
def get_daily_revenue(
    start_date: str | None = None,
    end_date: str | None = None,
    category: str | None = None,
    state: str | None = None,
    min_revenue: float | None = None,
    max_revenue: float | None = None,
):
    where_clause, params = _build_filter_clause(
        start_date, end_date, category, state, min_revenue, max_revenue
    )
    query = f"""
    SELECT
        DATE(order_date) AS date,
        COALESCE(SUM(payment_value), 0)::NUMERIC AS total_revenue
    FROM orders_clean
    {where_clause}
    GROUP BY DATE(order_date)
    ORDER BY DATE(order_date);
    """
    try:
        rows = fetch_all(query, params)
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
def get_daily_orders(
    start_date: str | None = None,
    end_date: str | None = None,
    category: str | None = None,
    state: str | None = None,
    min_revenue: float | None = None,
    max_revenue: float | None = None,
):
    where_clause, params = _build_filter_clause(
        start_date, end_date, category, state, min_revenue, max_revenue
    )
    query = f"""
    SELECT
        DATE(order_date) AS date,
        COUNT(*)::BIGINT AS order_count
    FROM orders_clean
    {where_clause}
    GROUP BY DATE(order_date)
    ORDER BY DATE(order_date);
    """
    try:
        rows = fetch_all(query, params)
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
def get_data_growth(
    start_date: str | None = None,
    end_date: str | None = None,
    category: str | None = None,
    state: str | None = None,
    min_revenue: float | None = None,
    max_revenue: float | None = None,
):
    where_clause, params = _build_filter_clause(
        start_date, end_date, category, state, min_revenue, max_revenue
    )
    query = f"""
    WITH daily_counts AS (
        SELECT
            DATE(order_date) AS date,
            COUNT(*)::BIGINT AS daily_count
        FROM orders_clean
        {where_clause}
        GROUP BY DATE(order_date)
    )
    SELECT
        date,
        SUM(daily_count) OVER (ORDER BY date)::BIGINT AS cumulative_orders
    FROM daily_counts
    ORDER BY date;
    """
    try:
        rows = fetch_all(query, params)
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
    """Return next-day revenue prediction from the persisted ML model."""
    try:
        return predict_next_day()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to generate prediction") from exc


@router.post("/train-model")
def train_model():
    try:
        return train_and_save_model()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to train model") from exc


@router.get("/model-metrics")
def get_model_metrics():
    try:
        return load_model_metrics()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to load model metrics") from exc


@router.get("/prediction-explanation")
def get_prediction_explanation():
    try:
        return explain_next_day_prediction()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to explain prediction") from exc


@router.get("/anomalies", response_model=None)
def get_anomalies():
    """Return detected revenue anomalies from the ML module."""
    try:
        return detect_anomalies()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to detect anomalies") from exc


@router.get("/category-analysis")
def get_category_analysis(
    start_date: str | None = None,
    end_date: str | None = None,
    category: str | None = None,
    state: str | None = None,
    min_revenue: float | None = None,
    max_revenue: float | None = None,
):
    where_clause, params = _build_filter_clause(
        start_date, end_date, category, state, min_revenue, max_revenue
    )
    query = f"""
    SELECT
        product_category_name,
        COALESCE(SUM(payment_value), 0)::NUMERIC AS revenue
    FROM orders_clean
    {where_clause}
    GROUP BY product_category_name
    ORDER BY revenue DESC;
    """
    try:
        rows = fetch_all(query, params)
        return [
            {
                "category": row["product_category_name"],
                "revenue": float(row["revenue"]),
            }
            for row in rows
        ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch category analysis") from exc


@router.get("/customer-segmentation")
def get_customer_segmentation(
    start_date: str | None = None,
    end_date: str | None = None,
    category: str | None = None,
    state: str | None = None,
    min_revenue: float | None = None,
    max_revenue: float | None = None,
):
    where_clause, params = _build_filter_clause(
        start_date, end_date, category, state, min_revenue, max_revenue
    )
    query = f"""
    WITH customer_spend AS (
        SELECT
            customer_id,
            COALESCE(SUM(payment_value), 0)::NUMERIC AS total_spend
        FROM orders_clean
        {where_clause}
        GROUP BY customer_id
    ),
    thresholds AS (
        SELECT
            percentile_cont(0.25) WITHIN GROUP (ORDER BY total_spend) AS p25,
            percentile_cont(0.75) WITHIN GROUP (ORDER BY total_spend) AS p75
        FROM customer_spend
    ),
    segmented AS (
        SELECT
            CASE
                WHEN total_spend > p75 THEN 'High'
                WHEN total_spend < p25 THEN 'Low'
                ELSE 'Medium'
            END AS segment
        FROM customer_spend
        CROSS JOIN thresholds
    )
    SELECT
        segment,
        COUNT(*)::BIGINT AS count
    FROM segmented
    GROUP BY segment;
    """
    try:
        rows = fetch_all(query, params)
        counts = {"High": 0, "Medium": 0, "Low": 0}
        for row in rows:
            counts[str(row["segment"])] = int(row["count"])

        return [
            {"segment": segment, "count": count}
            for segment, count in sorted(counts.items(), key=lambda item: SEGMENT_ORDER[item[0]])
        ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch customer segmentation") from exc


@router.get("/weekday-analysis")
def get_weekday_analysis(
    start_date: str | None = None,
    end_date: str | None = None,
    category: str | None = None,
    state: str | None = None,
    min_revenue: float | None = None,
    max_revenue: float | None = None,
):
    where_clause, params = _build_filter_clause(
        start_date, end_date, category, state, min_revenue, max_revenue
    )
    query = f"""
    SELECT
        EXTRACT(DOW FROM order_date)::INTEGER AS day,
        COALESCE(AVG(payment_value), 0)::NUMERIC AS avg_revenue
    FROM orders_clean
    {where_clause}
    GROUP BY day
    ORDER BY day;
    """
    try:
        rows = fetch_all(query, params)
        return [
            {
                "day": int(row["day"]),
                "avg_revenue": float(row["avg_revenue"]),
            }
            for row in rows
        ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch weekday analysis") from exc


@router.get("/insights")
def get_insights(
    start_date: str | None = None,
    end_date: str | None = None,
    category: str | None = None,
    state: str | None = None,
    min_revenue: float | None = None,
    max_revenue: float | None = None,
):
    try:
        return [
            {"insight": insight}
            for insight in _build_business_insights(
                start_date, end_date, category, state, min_revenue, max_revenue
            )
        ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to generate insights") from exc


@router.get("/recommendations")
def get_recommendations(
    start_date: str | None = None,
    end_date: str | None = None,
    category: str | None = None,
    state: str | None = None,
    min_revenue: float | None = None,
    max_revenue: float | None = None,
):
    try:
        insights = _build_business_insights(
            start_date, end_date, category, state, min_revenue, max_revenue
        )
        return [
            {"recommendation": recommendation}
            for recommendation in _build_business_recommendations(insights)
        ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to generate recommendations") from exc


@router.get("/geo-analysis")
def get_geo_analysis(
    start_date: str | None = None,
    end_date: str | None = None,
    category: str | None = None,
    state: str | None = None,
    min_revenue: float | None = None,
    max_revenue: float | None = None,
):
    where_clause, params = _build_filter_clause(
        start_date, end_date, category, state, min_revenue, max_revenue
    )
    query = f"""
    SELECT
        customer_state,
        COALESCE(SUM(payment_value), 0)::NUMERIC AS revenue
    FROM orders_clean
    {where_clause}
    GROUP BY customer_state
    ORDER BY revenue DESC;
    """
    try:
        rows = fetch_all(query, params)
        return [
            {
                "state": row["customer_state"],
                "revenue": float(row["revenue"]),
            }
            for row in rows
        ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch geo analysis") from exc


@router.get(
    "/cohort-retention",
    responses={
        200: {
            "content": {
                "application/json": {
                    "example": {
                        "cohorts": [
                            {"cohort_month": "2017-01", "retention": [100.0, 45.0, 30.0, 20.0]}
                        ]
                    }
                }
            }
        }
    },
)
def get_cohort_retention():
    try:
        return calculate_cohort_retention(fetch_orders_clean_dataframe())
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to calculate cohort retention") from exc


@router.get(
    "/revenue-decomposition",
    responses={
        200: {
            "content": {
                "application/json": {
                    "example": {
                        "total_change_pct": 12.5,
                        "order_contribution_pct": 8.2,
                        "aov_contribution_pct": 4.3,
                    }
                }
            }
        }
    },
)
def get_revenue_decomposition():
    try:
        return calculate_revenue_decomposition(fetch_orders_clean_dataframe())
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to calculate revenue decomposition") from exc


@router.get(
    "/churn-risk",
    responses={
        200: {
            "content": {
                "application/json": {
                    "example": {"high_risk_customers": 128, "potential_revenue_loss": 45231.75}
                }
            }
        }
    },
)
def get_churn_risk():
    try:
        return calculate_churn_risk(fetch_orders_clean_dataframe())
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to calculate churn risk") from exc


@router.get(
    "/anomaly-explanation",
    responses={
        200: {
            "content": {
                "application/json": {
                    "example": [
                        {
                            "date": "2017-03-20",
                            "top_category": "furniture_decor",
                            "category_increase_pct": 86.4,
                            "top_state": "SP",
                            "state_increase_pct": 74.2,
                        }
                    ]
                }
            }
        }
    },
)
def get_anomaly_explanation(anomaly_date: list[str] | None = Query(default=None)):
    try:
        return calculate_anomaly_root_cause(fetch_orders_clean_dataframe(), anomaly_date)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to explain anomalies") from exc


@router.get(
    "/customer-ltv",
    responses={
        200: {
            "content": {
                "application/json": {
                    "example": {
                        "top_customers": [
                            {"customer_id": "customer_123", "ltv": 1299.5},
                            {"customer_id": "customer_456", "ltv": 1175.25},
                        ]
                    }
                }
            }
        }
    },
)
def get_customer_ltv(limit: int = Query(default=10, ge=1, le=100)):
    try:
        return calculate_customer_ltv(fetch_orders_clean_dataframe(), limit)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to calculate customer LTV") from exc


@router.get("/filter-options")
def get_filter_options():
    query = """
    SELECT
        COALESCE(MIN(order_date)::date::text, '') AS min_date,
        COALESCE(MAX(order_date)::date::text, '') AS max_date,
        COALESCE(MIN(payment_value), 0)::NUMERIC AS min_revenue,
        COALESCE(MAX(payment_value), 0)::NUMERIC AS max_revenue
    FROM orders_clean;
    """
    categories_query = """
    SELECT DISTINCT product_category_name
    FROM orders_clean
    ORDER BY product_category_name;
    """
    states_query = """
    SELECT DISTINCT customer_state
    FROM orders_clean
    ORDER BY customer_state;
    """
    try:
        summary = fetch_one(query)
        categories = fetch_all(categories_query)
        states = fetch_all(states_query)
        return {
            "min_date": summary["min_date"],
            "max_date": summary["max_date"],
            "min_revenue": float(summary["min_revenue"]),
            "max_revenue": float(summary["max_revenue"]),
            "categories": [row["product_category_name"] for row in categories],
            "states": [row["customer_state"] for row in states],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch filter options") from exc
