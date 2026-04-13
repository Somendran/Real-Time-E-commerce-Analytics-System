from pathlib import Path

import joblib
import pandas as pd

from backend import ml


class DummyModel:
    def predict(self, rows):
        return [123.45 for _ in rows]


def test_build_daily_revenue_dataset_outputs_features() -> None:
    raw_df = pd.DataFrame(
        {
            "order_date": pd.to_datetime(["2024-01-01", "2024-01-01", "2024-01-03"]),
            "payment_value": [10.0, 15.0, 30.0],
        }
    )

    result = ml.build_daily_revenue_dataset(raw_df)

    assert {"date", "daily_revenue", "day_of_week", "rolling_mean_7", "lag_1"}.issubset(result.columns)
    assert len(result) == 3
    assert result["daily_revenue"].isna().sum() == 0


def test_predict_next_day_uses_saved_model(monkeypatch, tmp_path: Path) -> None:
    model_path = tmp_path / "model.pkl"
    joblib.dump(DummyModel(), model_path)
    monkeypatch.setattr(ml, "MODEL_PATH", model_path)
    monkeypatch.setattr(
        ml,
        "prepare_ml_dataframe",
        lambda: pd.DataFrame(
            {
                "date": pd.to_datetime(["2024-01-01", "2024-01-02"]),
                "daily_revenue": [100.0, 120.0],
                "day_of_week": [0, 1],
                "rolling_mean_7": [100.0, 110.0],
                "lag_1": [0.0, 100.0],
            }
        ),
    )

    prediction = ml.predict_next_day()

    assert prediction["predicted_revenue"] == 123.45
