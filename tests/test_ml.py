from pathlib import Path

import joblib
import pandas as pd

from backend import ml


class DummyModel:
    def predict(self, rows):
        return [123.45 for _ in rows]


def _sample_ml_dataframe() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "date": pd.date_range("2024-01-01", periods=8, freq="D"),
            "daily_revenue": [100.0, 120.0, 90.0, 130.0, 150.0, 140.0, 160.0, 180.0],
            "day_of_week": [0, 1, 2, 3, 4, 5, 6, 0],
            "day_of_month": [1, 2, 3, 4, 5, 6, 7, 8],
            "month": [1] * 8,
            "quarter": [1] * 8,
            "is_weekend": [0, 0, 0, 0, 0, 1, 1, 0],
            "lag_1": [100.0, 100.0, 120.0, 90.0, 130.0, 150.0, 140.0, 160.0],
            "lag_2": [100.0, 100.0, 100.0, 120.0, 90.0, 130.0, 150.0, 140.0],
            "lag_3": [100.0, 100.0, 100.0, 100.0, 120.0, 90.0, 130.0, 150.0],
            "lag_7": [100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0],
            "rolling_mean_3": [100.0, 110.0, 103.33, 113.33, 123.33, 140.0, 150.0, 160.0],
            "rolling_mean_7": [100.0, 110.0, 103.33, 110.0, 118.0, 121.67, 127.14, 138.57],
            "rolling_mean_14": [100.0, 110.0, 103.33, 110.0, 118.0, 121.67, 127.14, 133.75],
            "rolling_std_7": [0.0, 10.0, 12.47, 14.79, 20.4, 20.55, 22.49, 27.47],
            "revenue_change_1": [0.0, 20.0, -30.0, 40.0, 20.0, -10.0, 20.0, 20.0],
        }
    )


def test_build_daily_revenue_dataset_outputs_features() -> None:
    raw_df = pd.DataFrame(
        {
            "order_date": pd.to_datetime(
                ["2024-01-01", "2024-01-01", "2024-01-03", "2024-01-08"]
            ),
            "payment_value": [10.0, 15.0, 30.0, 40.0],
        }
    )

    result = ml.build_daily_revenue_dataset(raw_df)

    assert {"date", "daily_revenue", *ml.FEATURE_COLUMNS}.issubset(result.columns)
    assert {"lag_7", "rolling_std_7", "revenue_change_1"}.issubset(result.columns)
    assert len(result) == 8
    assert result[["daily_revenue", *ml.FEATURE_COLUMNS]].isna().sum().sum() == 0


def test_next_day_feature_order_matches_training_features() -> None:
    features = ml._build_next_day_features(_sample_ml_dataframe())

    assert list(features.columns) == ml.FEATURE_COLUMNS


def test_predict_next_day_uses_saved_model_and_returns_bounds(monkeypatch, tmp_path: Path) -> None:
    model_path = tmp_path / "model.pkl"
    metrics_path = tmp_path / "metrics.json"
    joblib.dump(DummyModel(), model_path)
    metrics_path.write_text('{"residual_std": 10.0}', encoding="utf-8")

    monkeypatch.setattr(ml, "MODEL_PATH", model_path)
    monkeypatch.setattr(ml, "METRICS_PATH", metrics_path)
    monkeypatch.setattr(ml, "prepare_ml_dataframe", _sample_ml_dataframe)

    prediction = ml.predict_next_day()

    assert prediction["predicted_revenue"] == 123.45
    assert prediction["lower_bound"] == 113.45
    assert prediction["upper_bound"] == 133.45


def test_train_and_save_model_writes_metadata(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(ml, "MODEL_DIR", tmp_path)
    monkeypatch.setattr(ml, "MODEL_PATH", tmp_path / "model.pkl")
    monkeypatch.setattr(ml, "METRICS_PATH", tmp_path / "metrics.json")
    monkeypatch.setattr(ml, "SHAP_SUMMARY_PATH", tmp_path / "shap_summary.json")
    monkeypatch.setattr(ml, "prepare_ml_dataframe", _sample_ml_dataframe)

    metrics = ml.train_and_save_model()

    assert (tmp_path / "model.pkl").exists()
    assert (tmp_path / "shap_summary.json").exists()
    assert metrics["model_type"] == "XGBRegressor"
    assert metrics["features"] == ml.FEATURE_COLUMNS
    assert "baseline_improvement_pct" in metrics
    assert "residual_std" in metrics
    assert metrics["training_rows"] > 0


def test_explain_next_day_prediction_returns_shap_drivers(monkeypatch, tmp_path: Path) -> None:
    model_path = tmp_path / "model.pkl"
    metrics_path = tmp_path / "metrics.json"
    shap_summary_path = tmp_path / "shap_summary.json"
    joblib.dump(DummyModel(), model_path)
    metrics_path.write_text('{"residual_std": 10.0}', encoding="utf-8")
    shap_summary_path.write_text(
        '{"feature_importance": [{"feature": "lag_7", "mean_abs_shap": 99.0}]}',
        encoding="utf-8",
    )

    monkeypatch.setattr(ml, "MODEL_PATH", model_path)
    monkeypatch.setattr(ml, "METRICS_PATH", metrics_path)
    monkeypatch.setattr(ml, "SHAP_SUMMARY_PATH", shap_summary_path)
    monkeypatch.setattr(ml, "prepare_ml_dataframe", _sample_ml_dataframe)
    monkeypatch.setattr(
        ml,
        "_extract_shap_array",
        lambda shap_values: pd.DataFrame([[float(i) for i, _ in enumerate(ml.FEATURE_COLUMNS)]]).to_numpy(),
    )

    class FakeExplainer:
        def __init__(self, model):
            self.model = model

        def __call__(self, feature_df):
            return feature_df

    monkeypatch.setattr(ml.shap, "Explainer", FakeExplainer)

    explanation = ml.explain_next_day_prediction(top_n=3)

    assert explanation["predicted_revenue"] == 123.45
    assert len(explanation["top_features"]) == 3
    assert explanation["global_feature_importance"][0]["feature"] == "lag_7"
