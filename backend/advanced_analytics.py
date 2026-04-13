from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from backend.db import fetch_all


REQUIRED_COLUMNS = [
    "order_id",
    "customer_id",
    "order_date",
    "payment_value",
    "product_category_name",
    "customer_state",
    "review_score",
]


def fetch_orders_clean_dataframe() -> pd.DataFrame:
    rows = fetch_all(
        """
        SELECT
            order_id,
            customer_id,
            order_date,
            payment_value,
            product_category_name,
            customer_state,
            review_score
        FROM orders_clean;
        """
    )
    return prepare_orders_dataframe(pd.DataFrame(rows))


def prepare_orders_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=REQUIRED_COLUMNS)

    prepared = df.copy()
    for column in REQUIRED_COLUMNS:
        if column not in prepared.columns:
            prepared[column] = np.nan

    prepared["order_date"] = pd.to_datetime(prepared["order_date"], errors="coerce")
    prepared["payment_value"] = pd.to_numeric(prepared["payment_value"], errors="coerce").fillna(0.0)
    prepared["review_score"] = pd.to_numeric(prepared["review_score"], errors="coerce")
    prepared["product_category_name"] = prepared["product_category_name"].fillna("Unknown").astype(str)
    prepared["customer_state"] = prepared["customer_state"].fillna("Unknown").astype(str)
    prepared["customer_id"] = prepared["customer_id"].fillna("Unknown").astype(str)
    prepared["order_id"] = prepared["order_id"].fillna("").astype(str)

    prepared = prepared.dropna(subset=["order_date"])
    prepared = prepared[prepared["customer_id"] != "Unknown"]
    prepared = prepared.sort_values("order_date").reset_index(drop=True)

    return prepared[REQUIRED_COLUMNS]


def calculate_cohort_retention(df: pd.DataFrame) -> dict[str, list[dict[str, Any]]]:
    orders = prepare_orders_dataframe(df)
    if orders.empty:
        return {"cohorts": []}

    orders["order_month"] = orders["order_date"].dt.to_period("M")
    first_purchase = orders.groupby("customer_id", as_index=False)["order_month"].min()
    first_purchase = first_purchase.rename(columns={"order_month": "cohort_month"})
    cohort_orders = orders.merge(first_purchase, on="customer_id", how="inner")
    cohort_orders["period_number"] = (
        (cohort_orders["order_month"].dt.year - cohort_orders["cohort_month"].dt.year) * 12
        + (cohort_orders["order_month"].dt.month - cohort_orders["cohort_month"].dt.month)
    )

    active_customers = (
        cohort_orders.groupby(["cohort_month", "period_number"])["customer_id"]
        .nunique()
        .reset_index(name="active_customers")
    )
    cohort_sizes = (
        first_purchase.groupby("cohort_month")["customer_id"]
        .nunique()
        .reset_index(name="cohort_size")
    )
    retention = active_customers.merge(cohort_sizes, on="cohort_month", how="left")
    retention["retention_pct"] = np.where(
        retention["cohort_size"] > 0,
        retention["active_customers"] / retention["cohort_size"] * 100,
        0.0,
    )

    max_period = int(retention["period_number"].max()) if not retention.empty else 0
    cohorts: list[dict[str, Any]] = []
    for cohort_month, group in retention.groupby("cohort_month", sort=True):
        values = {int(row.period_number): float(row.retention_pct) for row in group.itertuples()}
        retention_values = [round(values.get(period, 0.0), 2) for period in range(max_period + 1)]
        if retention_values:
            retention_values[0] = 100.0
        cohorts.append(
            {
                "cohort_month": str(cohort_month),
                "retention": retention_values,
            }
        )

    return {"cohorts": cohorts}


def calculate_revenue_decomposition(df: pd.DataFrame) -> dict[str, float]:
    orders = prepare_orders_dataframe(df)
    if orders.empty:
        return {
            "total_change_pct": 0.0,
            "order_contribution_pct": 0.0,
            "aov_contribution_pct": 0.0,
        }

    start_date = orders["order_date"].min()
    end_date = orders["order_date"].max()
    midpoint = start_date + ((end_date - start_date) / 2)
    previous = orders[orders["order_date"] <= midpoint]
    current = orders[orders["order_date"] > midpoint]

    if previous.empty or current.empty:
        return {
            "total_change_pct": 0.0,
            "order_contribution_pct": 0.0,
            "aov_contribution_pct": 0.0,
        }

    previous_orders = max(int(previous["order_id"].nunique()), 1)
    current_orders = max(int(current["order_id"].nunique()), 1)
    previous_revenue = float(previous["payment_value"].sum())
    current_revenue = float(current["payment_value"].sum())
    previous_aov = previous_revenue / previous_orders
    current_aov = current_revenue / current_orders

    if previous_revenue == 0:
        return {
            "total_change_pct": 0.0,
            "order_contribution_pct": 0.0,
            "aov_contribution_pct": 0.0,
        }

    order_effect = (current_orders - previous_orders) * previous_aov
    aov_effect = current_orders * (current_aov - previous_aov)
    total_change = current_revenue - previous_revenue

    return {
        "total_change_pct": round(float((total_change / previous_revenue) * 100), 2),
        "order_contribution_pct": round(float((order_effect / previous_revenue) * 100), 2),
        "aov_contribution_pct": round(float((aov_effect / previous_revenue) * 100), 2),
    }


def calculate_churn_risk(df: pd.DataFrame) -> dict[str, float | int]:
    orders = prepare_orders_dataframe(df)
    if orders.empty:
        return {"high_risk_customers": 0, "potential_revenue_loss": 0.0}

    analysis_date = orders["order_date"].max()
    cutoff_date = analysis_date - pd.Timedelta(days=30)
    prior_cutoff = cutoff_date - pd.Timedelta(days=30)

    customer_summary = orders.groupby("customer_id").agg(
        last_order_date=("order_date", "max"),
        total_spent=("payment_value", "sum"),
        total_orders=("order_id", "nunique"),
    )
    customer_summary["days_since_last_purchase"] = (
        analysis_date - customer_summary["last_order_date"]
    ).dt.days

    current_window = orders[orders["order_date"] > cutoff_date]
    previous_window = orders[
        (orders["order_date"] > prior_cutoff) & (orders["order_date"] <= cutoff_date)
    ]

    current_activity = current_window.groupby("customer_id").agg(
        current_orders=("order_id", "nunique"),
        current_spend=("payment_value", "sum"),
    )
    previous_activity = previous_window.groupby("customer_id").agg(
        previous_orders=("order_id", "nunique"),
        previous_spend=("payment_value", "sum"),
    )

    risk_df = customer_summary.join(current_activity, how="left").join(previous_activity, how="left")
    risk_df[["current_orders", "current_spend", "previous_orders", "previous_spend"]] = risk_df[
        ["current_orders", "current_spend", "previous_orders", "previous_spend"]
    ].fillna(0.0)
    risk_df["declining_activity"] = risk_df["current_orders"] < risk_df["previous_orders"]
    risk_df["declining_spend"] = risk_df["current_spend"] < risk_df["previous_spend"]
    risk_df["is_high_risk"] = (
        (risk_df["days_since_last_purchase"] > 30)
        & (risk_df["declining_activity"] | risk_df["declining_spend"])
    )

    high_risk = risk_df[risk_df["is_high_risk"]].copy()
    high_risk["avg_order_value"] = np.where(
        high_risk["total_orders"] > 0,
        high_risk["total_spent"] / high_risk["total_orders"],
        0.0,
    )
    high_risk["potential_loss"] = high_risk[["previous_spend", "avg_order_value"]].max(axis=1)

    return {
        "high_risk_customers": int(high_risk.shape[0]),
        "potential_revenue_loss": round(float(high_risk["potential_loss"].sum()), 2),
    }


def _percentage_increase(current_value: float, baseline_value: float) -> float:
    if baseline_value <= 0:
        return 0.0 if current_value <= 0 else 100.0
    return float(((current_value - baseline_value) / baseline_value) * 100)


def _detect_anomaly_dates(orders: pd.DataFrame, z_threshold: float = 2.5) -> list[pd.Timestamp]:
    daily_revenue = orders.groupby(orders["order_date"].dt.date)["payment_value"].sum()
    if daily_revenue.empty:
        return []

    std = float(daily_revenue.std(ddof=0))
    if std == 0.0:
        return []

    z_scores = (daily_revenue - float(daily_revenue.mean())) / std
    return [pd.Timestamp(date) for date in z_scores[z_scores.abs() > z_threshold].index]


def calculate_anomaly_root_cause(
    df: pd.DataFrame,
    anomaly_dates: list[str] | None = None,
) -> list[dict[str, float | str]]:
    orders = prepare_orders_dataframe(df)
    if orders.empty:
        return []

    if anomaly_dates:
        dates = [pd.Timestamp(date).normalize() for date in anomaly_dates]
    else:
        dates = _detect_anomaly_dates(orders)

    results: list[dict[str, float | str]] = []
    orders["order_day"] = orders["order_date"].dt.normalize()
    for anomaly_date in sorted(set(dates)):
        day_orders = orders[orders["order_day"] == anomaly_date]
        baseline_orders = orders[orders["order_day"] != anomaly_date]
        if day_orders.empty or baseline_orders.empty:
            continue

        category_revenue = day_orders.groupby("product_category_name")["payment_value"].sum()
        state_revenue = day_orders.groupby("customer_state")["payment_value"].sum()
        top_category = str(category_revenue.idxmax())
        top_state = str(state_revenue.idxmax())

        baseline_category_daily = (
            baseline_orders[baseline_orders["product_category_name"] == top_category]
            .groupby("order_day")["payment_value"]
            .sum()
            .mean()
        )
        baseline_state_daily = (
            baseline_orders[baseline_orders["customer_state"] == top_state]
            .groupby("order_day")["payment_value"]
            .sum()
            .mean()
        )

        results.append(
            {
                "date": anomaly_date.date().isoformat(),
                "top_category": top_category,
                "category_increase_pct": round(
                    _percentage_increase(float(category_revenue[top_category]), float(baseline_category_daily or 0.0)),
                    2,
                ),
                "top_state": top_state,
                "state_increase_pct": round(
                    _percentage_increase(float(state_revenue[top_state]), float(baseline_state_daily or 0.0)),
                    2,
                ),
            }
        )

    return results


def calculate_customer_ltv(df: pd.DataFrame, limit: int = 10) -> dict[str, list[dict[str, float | str]]]:
    orders = prepare_orders_dataframe(df)
    if orders.empty:
        return {"top_customers": []}

    customer_summary = orders.groupby("customer_id").agg(
        total_spent=("payment_value", "sum"),
        total_orders=("order_id", "nunique"),
        first_order_date=("order_date", "min"),
        last_order_date=("order_date", "max"),
    )
    customer_summary["active_days"] = (
        customer_summary["last_order_date"] - customer_summary["first_order_date"]
    ).dt.days.clip(lower=1)
    customer_summary["avg_order_value"] = np.where(
        customer_summary["total_orders"] > 0,
        customer_summary["total_spent"] / customer_summary["total_orders"],
        0.0,
    )
    customer_summary["purchase_frequency"] = np.where(
        customer_summary["active_days"] > 0,
        customer_summary["total_orders"] / customer_summary["active_days"],
        0.0,
    )
    customer_summary["lifespan_days"] = customer_summary["active_days"]
    customer_summary["ltv"] = (
        customer_summary["avg_order_value"]
        * customer_summary["purchase_frequency"]
        * customer_summary["lifespan_days"]
    )

    top_customers = (
        customer_summary.sort_values("ltv", ascending=False)
        .head(max(limit, 1))
        .reset_index()[["customer_id", "ltv"]]
    )

    return {
        "top_customers": [
            {"customer_id": str(row.customer_id), "ltv": round(float(row.ltv), 2)}
            for row in top_customers.itertuples()
        ]
    }
