from __future__ import annotations

import numpy as np
import pandas as pd
from xgboost import XGBRegressor

from backend.db import fetch_all


FEATURE_COLUMNS = ["day_of_week", "rolling_mean_7", "lag_1"]
TARGET_COLUMN = "daily_revenue"


def load_orders_data() -> pd.DataFrame:
    """Load raw order_date and payment_value data from PostgreSQL."""
    query = """
    SELECT
        order_date,
        payment_value
    FROM orders_clean;
    """

    rows = fetch_all(query)
    df = pd.DataFrame(rows)

    if df.empty:
        return pd.DataFrame(columns=["order_date", "payment_value"])

    df["order_date"] = pd.to_datetime(df["order_date"], errors="coerce")
    df["payment_value"] = pd.to_numeric(df["payment_value"], errors="coerce")

    # Drop invalid dates, fill missing revenue with 0.
    df = df.dropna(subset=["order_date"])
    df["payment_value"] = df["payment_value"].fillna(0.0)

    return df


def build_daily_revenue_dataset(raw_df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate to daily revenue and engineer time-series features."""
    if raw_df.empty:
        return pd.DataFrame(
            columns=["date", "daily_revenue", "day_of_week", "rolling_mean_7", "lag_1"]
        )

    grouped_daily = (
        raw_df.assign(date=raw_df["order_date"].dt.date)
        .groupby("date", as_index=False)["payment_value"]
        .sum()
        .rename(columns={"payment_value": "daily_revenue"})
    )

    grouped_daily["date"] = pd.to_datetime(grouped_daily["date"])
    grouped_daily = grouped_daily.sort_values("date").reset_index(drop=True)

    # Build continuous calendar and merge daily aggregates into it.
    full_dates = pd.DataFrame(
        {
            "date": pd.date_range(
                start=grouped_daily["date"].min(),
                end=grouped_daily["date"].max(),
                freq="D",
            )
        }
    )
    daily = full_dates.merge(grouped_daily, on="date", how="left")

    daily["daily_revenue"] = pd.to_numeric(daily["daily_revenue"], errors="coerce")

    # Interpolate only missing days; keep observed values (including true zeros) untouched.
    missing_mask = daily["daily_revenue"].isna()
    interpolated = daily["daily_revenue"].interpolate(method="linear", limit_direction="both")
    daily.loc[missing_mask, "daily_revenue"] = interpolated.loc[missing_mask]

    # Fill any remaining gaps at boundaries with nearest known value.
    daily["daily_revenue"] = daily["daily_revenue"].ffill().bfill()

    # Fallback only for degenerate case where all values were missing.
    daily["daily_revenue"] = daily["daily_revenue"].fillna(0.0)

    daily["day_of_week"] = daily["date"].dt.dayofweek
    daily["rolling_mean_7"] = daily["daily_revenue"].rolling(window=7, min_periods=1).mean()
    daily["lag_1"] = daily["daily_revenue"].shift(1)

    # Handle engineered-feature nulls at series start.
    daily["lag_1"] = daily["lag_1"].fillna(0.0)
    daily["rolling_mean_7"] = daily["rolling_mean_7"].fillna(daily["daily_revenue"])

    return daily


def prepare_ml_dataframe() -> pd.DataFrame:
    """
    Full ML prep pipeline:
    1) Load from DB
    2) Aggregate daily
    3) Generate model features
    4) Return clean DataFrame
    """
    raw_df = load_orders_data()
    ml_df = build_daily_revenue_dataset(raw_df)

    if ml_df.empty:
        return ml_df

    # Enforce stable dtypes for downstream ML libraries.
    ml_df["day_of_week"] = ml_df["day_of_week"].astype(int)
    ml_df["daily_revenue"] = ml_df["daily_revenue"].astype(float)
    ml_df["rolling_mean_7"] = ml_df["rolling_mean_7"].astype(float)
    ml_df["lag_1"] = ml_df["lag_1"].astype(float)

    return ml_df


def train_revenue_model(ml_df: pd.DataFrame) -> XGBRegressor:
    """Train a fast XGBoost regressor from engineered features."""
    if ml_df.empty:
        raise ValueError("Cannot train model: ML dataframe is empty.")

    missing_features = [col for col in FEATURE_COLUMNS + [TARGET_COLUMN] if col not in ml_df.columns]
    if missing_features:
        raise ValueError(f"Missing columns required for training: {missing_features}")

    training_df = ml_df[FEATURE_COLUMNS + [TARGET_COLUMN]].copy()
    training_df = training_df.replace([np.inf, -np.inf], np.nan).dropna()
    if training_df.empty:
        raise ValueError("Cannot train model: no valid rows after cleaning.")

    x = training_df[FEATURE_COLUMNS].to_numpy(dtype=float)
    y = training_df[TARGET_COLUMN].to_numpy(dtype=float)

    # Keep the model lightweight for quick retraining during API calls.
    model = XGBRegressor(
        objective="reg:squarederror",
        n_estimators=80,
        max_depth=3,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        n_jobs=1,
    )
    model.fit(x, y)
    return model


def _build_next_day_features(ml_df: pd.DataFrame) -> pd.DataFrame:
    """Create one-row feature frame for next-day prediction."""
    if ml_df.empty:
        raise ValueError("Cannot build prediction features from an empty dataframe.")

    latest_date = pd.to_datetime(ml_df["date"]).max()
    next_date = latest_date + pd.Timedelta(days=1)

    last_revenue = float(ml_df[TARGET_COLUMN].iloc[-1])
    rolling_mean_7 = float(ml_df[TARGET_COLUMN].tail(7).mean())

    return pd.DataFrame(
        [
            {
                "day_of_week": int(next_date.dayofweek),
                "rolling_mean_7": rolling_mean_7,
                "lag_1": last_revenue,
            }
        ]
    )


def predict_next_day() -> dict[str, float]:
    """
    Train a regression model and predict next-day revenue.

    Returns:
        {"predicted_revenue": value}
    """
    ml_df = prepare_ml_dataframe()
    model = train_revenue_model(ml_df)
    next_features = _build_next_day_features(ml_df)

    prediction = float(
        model.predict(next_features[FEATURE_COLUMNS].to_numpy(dtype=float))[0]
    )

    # Keep the prediction non-negative for revenue semantics.
    prediction = max(0.0, prediction)

    return {"predicted_revenue": prediction}


def detect_anomalies(z_threshold: float = 2.5) -> list[dict[str, float | str]]:
    """
    Detect daily revenue anomalies using Z-score.

    An anomaly is flagged when abs(z_score) > z_threshold.

    Returns:
        [
            {"date": "YYYY-MM-DD", "revenue": value, "z_score": value},
            ...
        ]
    """
    ml_df = prepare_ml_dataframe()
    if ml_df.empty:
        return []

    revenue = pd.to_numeric(ml_df[TARGET_COLUMN], errors="coerce").fillna(0.0)
    mean_revenue = float(revenue.mean())
    std_revenue = float(revenue.std(ddof=0))

    # If standard deviation is zero, all values are identical; no anomalies.
    if std_revenue == 0.0:
        return []

    z_scores = (revenue - mean_revenue) / std_revenue
    anomalies_df = ml_df.loc[z_scores.abs() > z_threshold, ["date", TARGET_COLUMN]].copy()
    anomalies_df["z_score"] = z_scores.loc[anomalies_df.index]

    anomalies: list[dict[str, float | str]] = []
    for _, row in anomalies_df.iterrows():
        anomalies.append(
            {
                "date": pd.to_datetime(row["date"]).date().isoformat(),
                "revenue": float(row[TARGET_COLUMN]),
                "z_score": float(row["z_score"]),
            }
        )

    return anomalies


if __name__ == "__main__":
    dataset = prepare_ml_dataframe()
    print(dataset.head(10))
    print(f"Rows prepared for ML: {len(dataset)}")
    print(predict_next_day())
    print(detect_anomalies())
