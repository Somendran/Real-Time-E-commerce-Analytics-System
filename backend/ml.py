from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import shap
from xgboost import XGBRegressor

from backend.db import fetch_all


FEATURE_COLUMNS = [
    "day_of_week",
    "day_of_month",
    "month",
    "quarter",
    "is_weekend",
    "lag_1",
    "lag_2",
    "lag_3",
    "lag_7",
    "rolling_mean_3",
    "rolling_mean_7",
    "rolling_mean_14",
    "rolling_std_7",
    "revenue_change_1",
]
TARGET_COLUMN = "daily_revenue"
MODEL_TYPE = "XGBRegressor"
MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "model.pkl"
METRICS_PATH = MODEL_DIR / "metrics.json"
SHAP_SUMMARY_PATH = MODEL_DIR / "shap_summary.json"
TOP_SHAP_FEATURES = 5


def load_orders_data() -> pd.DataFrame:
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

    df = df.dropna(subset=["order_date"])
    df["payment_value"] = df["payment_value"].fillna(0.0)

    return df


def build_daily_revenue_dataset(raw_df: pd.DataFrame) -> pd.DataFrame:
    if raw_df.empty:
        return pd.DataFrame(columns=["date", TARGET_COLUMN, *FEATURE_COLUMNS])

    grouped_daily = (
        raw_df.assign(date=raw_df["order_date"].dt.date)
        .groupby("date", as_index=False)["payment_value"]
        .sum()
        .rename(columns={"payment_value": TARGET_COLUMN})
    )

    grouped_daily["date"] = pd.to_datetime(grouped_daily["date"])
    grouped_daily = grouped_daily.sort_values("date").reset_index(drop=True)

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

    daily[TARGET_COLUMN] = pd.to_numeric(daily[TARGET_COLUMN], errors="coerce")
    missing_mask = daily[TARGET_COLUMN].isna()
    interpolated = daily[TARGET_COLUMN].interpolate(method="linear", limit_direction="both")
    daily.loc[missing_mask, TARGET_COLUMN] = interpolated.loc[missing_mask]
    daily[TARGET_COLUMN] = daily[TARGET_COLUMN].ffill().bfill().fillna(0.0)

    return build_time_series_features(daily)


def build_time_series_features(daily: pd.DataFrame) -> pd.DataFrame:
    if daily.empty:
        return pd.DataFrame(columns=["date", TARGET_COLUMN, *FEATURE_COLUMNS])

    daily = daily.copy()
    daily["date"] = pd.to_datetime(daily["date"], errors="coerce")
    daily[TARGET_COLUMN] = pd.to_numeric(daily[TARGET_COLUMN], errors="coerce").fillna(0.0)
    daily = daily.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)

    daily["day_of_week"] = daily["date"].dt.dayofweek
    daily["day_of_month"] = daily["date"].dt.day
    daily["month"] = daily["date"].dt.month
    daily["quarter"] = daily["date"].dt.quarter
    daily["is_weekend"] = daily["day_of_week"].isin([5, 6]).astype(int)

    revenue_history = daily[TARGET_COLUMN].shift(1)
    for lag in [1, 2, 3, 7]:
        daily[f"lag_{lag}"] = daily[TARGET_COLUMN].shift(lag)

    daily["rolling_mean_3"] = revenue_history.rolling(window=3, min_periods=1).mean()
    daily["rolling_mean_7"] = revenue_history.rolling(window=7, min_periods=1).mean()
    daily["rolling_mean_14"] = revenue_history.rolling(window=14, min_periods=1).mean()
    daily["rolling_std_7"] = (
        revenue_history.rolling(window=7, min_periods=2).std(ddof=0).fillna(0.0)
    )
    daily["revenue_change_1"] = revenue_history.diff(1)

    for feature in FEATURE_COLUMNS:
        daily[feature] = pd.to_numeric(daily[feature], errors="coerce")

    daily[FEATURE_COLUMNS] = daily[FEATURE_COLUMNS].ffill().bfill().fillna(0.0)

    return daily


def prepare_ml_dataframe() -> pd.DataFrame:
    raw_df = load_orders_data()
    ml_df = build_daily_revenue_dataset(raw_df)

    if ml_df.empty:
        return ml_df

    ml_df[TARGET_COLUMN] = ml_df[TARGET_COLUMN].astype(float)
    for feature in FEATURE_COLUMNS:
        ml_df[feature] = ml_df[feature].astype(float)

    return ml_df


def _clean_training_dataframe(ml_df: pd.DataFrame) -> pd.DataFrame:
    if ml_df.empty:
        raise ValueError("Cannot train model: ML dataframe is empty.")

    missing_features = [col for col in FEATURE_COLUMNS + [TARGET_COLUMN] if col not in ml_df.columns]
    if missing_features:
        raise ValueError(f"Missing columns required for training: {missing_features}")

    training_df = ml_df[FEATURE_COLUMNS + [TARGET_COLUMN]].copy()
    training_df = training_df.replace([np.inf, -np.inf], np.nan).dropna()
    if training_df.empty:
        raise ValueError("Cannot train model: no valid rows after cleaning.")

    return training_df


def _new_revenue_model() -> XGBRegressor:
    return XGBRegressor(
        objective="reg:squarederror",
        n_estimators=160,
        max_depth=3,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        n_jobs=1,
    )


def _time_based_train_test_split(training_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    if len(training_df) < 5:
        return training_df, training_df.iloc[0:0]

    split_index = max(1, int(len(training_df) * 0.8))
    if split_index >= len(training_df):
        split_index = len(training_df) - 1

    return training_df.iloc[:split_index], training_df.iloc[split_index:]


def train_revenue_model(ml_df: pd.DataFrame) -> XGBRegressor:
    training_df = _clean_training_dataframe(ml_df)
    train_df, _ = _time_based_train_test_split(training_df)
    x = train_df[FEATURE_COLUMNS].to_numpy(dtype=float)
    y = train_df[TARGET_COLUMN].to_numpy(dtype=float)

    model = _new_revenue_model()
    model.fit(x, y)
    return model


def _safe_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    non_zero_mask = y_true != 0
    if not non_zero_mask.any():
        return 0.0
    return float(np.mean(np.abs((y_true[non_zero_mask] - y_pred[non_zero_mask]) / y_true[non_zero_mask])) * 100)


def _calculate_regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    errors = y_true - y_pred
    return {
        "mae": float(np.mean(np.abs(errors))),
        "rmse": float(np.sqrt(np.mean(np.square(errors)))),
        "mape": _safe_mape(y_true, y_pred),
    }


def _evaluate_model(
    model: XGBRegressor,
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
) -> dict[str, float | int]:
    if test_df.empty:
        return {
            "mae": 0.0,
            "rmse": 0.0,
            "mape": 0.0,
            "baseline_mae": 0.0,
            "baseline_rmse": 0.0,
            "baseline_mape": 0.0,
            "baseline_improvement_pct": 0.0,
            "residual_std": 0.0,
            "training_rows": int(len(train_df)),
            "test_rows": 0,
        }

    x_test = test_df[FEATURE_COLUMNS].to_numpy(dtype=float)
    y_true = test_df[TARGET_COLUMN].to_numpy(dtype=float)
    y_pred = model.predict(x_test)
    baseline_pred = test_df["lag_1"].to_numpy(dtype=float)

    model_metrics = _calculate_regression_metrics(y_true, y_pred)
    baseline_metrics = _calculate_regression_metrics(y_true, baseline_pred)
    residuals = y_true - y_pred

    baseline_mae = baseline_metrics["mae"]
    if baseline_mae > 0:
        improvement_pct = ((baseline_mae - model_metrics["mae"]) / baseline_mae) * 100
    else:
        improvement_pct = 0.0

    return {
        **model_metrics,
        "baseline_mae": baseline_metrics["mae"],
        "baseline_rmse": baseline_metrics["rmse"],
        "baseline_mape": baseline_metrics["mape"],
        "baseline_improvement_pct": float(improvement_pct),
        "residual_std": float(np.std(residuals, ddof=0)),
        "training_rows": int(len(train_df)),
        "test_rows": int(len(test_df)),
    }


def train_and_save_model() -> dict[str, Any]:
    ml_df = prepare_ml_dataframe()
    training_df = _clean_training_dataframe(ml_df)
    train_df, test_df = _time_based_train_test_split(training_df)

    model = _new_revenue_model()
    model.fit(
        train_df[FEATURE_COLUMNS].to_numpy(dtype=float),
        train_df[TARGET_COLUMN].to_numpy(dtype=float),
    )

    metrics = _evaluate_model(model, train_df, test_df)
    shap_summary = _build_shap_summary(model, train_df[FEATURE_COLUMNS])
    last_trained_at = datetime.now(timezone.utc).isoformat()

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    payload: dict[str, Any] = {
        "model_type": MODEL_TYPE,
        "model_version": last_trained_at,
        "features": FEATURE_COLUMNS,
        **metrics,
        "last_trained_at": last_trained_at,
    }
    METRICS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    SHAP_SUMMARY_PATH.write_text(json.dumps(shap_summary, indent=2), encoding="utf-8")

    return payload


def load_model() -> XGBRegressor:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            "Saved model not found. Run train_and_save_model() or POST /train-model first."
        )
    return joblib.load(MODEL_PATH)


def load_model_metrics() -> dict[str, Any]:
    if not METRICS_PATH.exists():
        return {
            "model_type": MODEL_TYPE,
            "model_version": None,
            "features": FEATURE_COLUMNS,
            "mae": None,
            "rmse": None,
            "mape": None,
            "baseline_mae": None,
            "baseline_rmse": None,
            "baseline_mape": None,
            "baseline_improvement_pct": None,
            "residual_std": None,
            "training_rows": None,
            "test_rows": None,
            "last_trained_at": None,
        }

    return json.loads(METRICS_PATH.read_text(encoding="utf-8"))


def _extract_shap_array(shap_values: Any) -> np.ndarray:
    values = shap_values.values if hasattr(shap_values, "values") else shap_values
    values_array = np.asarray(values, dtype=float)

    if values_array.ndim == 3:
        values_array = values_array[:, :, 0]
    if values_array.ndim == 1:
        values_array = values_array.reshape(1, -1)

    return values_array


def _build_shap_summary(model: XGBRegressor, feature_df: pd.DataFrame) -> dict[str, Any]:
    if feature_df.empty:
        return {"feature_importance": []}

    explainer = shap.Explainer(model)
    shap_values = explainer(feature_df)
    values_array = _extract_shap_array(shap_values)
    mean_abs_values = np.abs(values_array).mean(axis=0)

    feature_importance = sorted(
        [
            {"feature": feature, "mean_abs_shap": float(mean_abs_values[idx])}
            for idx, feature in enumerate(FEATURE_COLUMNS)
        ],
        key=lambda item: item["mean_abs_shap"],
        reverse=True,
    )

    return {"feature_importance": feature_importance}


def load_shap_summary() -> dict[str, Any]:
    if not SHAP_SUMMARY_PATH.exists():
        return {"feature_importance": []}

    return json.loads(SHAP_SUMMARY_PATH.read_text(encoding="utf-8"))


def _build_next_day_features(ml_df: pd.DataFrame) -> pd.DataFrame:
    if ml_df.empty:
        raise ValueError("Cannot build prediction features from an empty dataframe.")

    daily = ml_df.sort_values("date").reset_index(drop=True)
    latest_date = pd.to_datetime(daily["date"]).max()
    next_date = latest_date + pd.Timedelta(days=1)
    revenue = daily[TARGET_COLUMN].astype(float)

    feature_row = {
        "day_of_week": float(next_date.dayofweek),
        "day_of_month": float(next_date.day),
        "month": float(next_date.month),
        "quarter": float(next_date.quarter),
        "is_weekend": float(1 if next_date.dayofweek in [5, 6] else 0),
        "lag_1": float(revenue.iloc[-1]) if len(revenue) >= 1 else 0.0,
        "lag_2": float(revenue.iloc[-2]) if len(revenue) >= 2 else float(revenue.iloc[-1]),
        "lag_3": float(revenue.iloc[-3]) if len(revenue) >= 3 else float(revenue.iloc[-1]),
        "lag_7": float(revenue.iloc[-7]) if len(revenue) >= 7 else float(revenue.iloc[0]),
        "rolling_mean_3": float(revenue.tail(3).mean()),
        "rolling_mean_7": float(revenue.tail(7).mean()),
        "rolling_mean_14": float(revenue.tail(14).mean()),
        "rolling_std_7": float(revenue.tail(7).std(ddof=0)) if len(revenue.tail(7)) >= 2 else 0.0,
        "revenue_change_1": float(revenue.iloc[-1] - revenue.iloc[-2]) if len(revenue) >= 2 else 0.0,
    }

    return pd.DataFrame([{feature: feature_row[feature] for feature in FEATURE_COLUMNS}])


def _prediction_bounds(prediction: float) -> tuple[float, float]:
    metrics = load_model_metrics()
    residual_std = metrics.get("residual_std")
    try:
        spread = float(residual_std or 0.0)
    except (TypeError, ValueError):
        spread = 0.0

    return max(0.0, prediction - spread), prediction + spread


def predict_next_day() -> dict[str, float]:
    model = load_model()
    ml_df = prepare_ml_dataframe()
    next_features = _build_next_day_features(ml_df)
    prediction_input = next_features[FEATURE_COLUMNS].to_numpy(dtype=float)

    prediction = float(model.predict(prediction_input)[0])
    prediction = max(0.0, prediction)
    lower_bound, upper_bound = _prediction_bounds(prediction)

    return {
        "predicted_revenue": prediction,
        "lower_bound": lower_bound,
        "upper_bound": upper_bound,
    }


def explain_next_day_prediction(top_n: int = TOP_SHAP_FEATURES) -> dict[str, Any]:
    model = load_model()
    ml_df = prepare_ml_dataframe()
    next_features = _build_next_day_features(ml_df)
    prediction = predict_next_day()

    explainer = shap.Explainer(model)
    shap_values = explainer(next_features[FEATURE_COLUMNS])
    values_array = _extract_shap_array(shap_values)
    impacts = values_array[0]

    top_features = sorted(
        [
            {
                "feature": feature,
                "value": float(next_features.iloc[0][feature]),
                "impact": float(impacts[idx]),
            }
            for idx, feature in enumerate(FEATURE_COLUMNS)
        ],
        key=lambda item: abs(item["impact"]),
        reverse=True,
    )[:top_n]

    return {
        **prediction,
        "top_features": top_features,
        "global_feature_importance": load_shap_summary().get("feature_importance", []),
    }


def detect_anomalies(z_threshold: float = 2.5) -> list[dict[str, float | str]]:
    ml_df = prepare_ml_dataframe()
    if ml_df.empty:
        return []

    revenue = pd.to_numeric(ml_df[TARGET_COLUMN], errors="coerce").fillna(0.0)
    mean_revenue = float(revenue.mean())
    std_revenue = float(revenue.std(ddof=0))

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
    print(train_and_save_model())
    print(predict_next_day())
    print(detect_anomalies())
