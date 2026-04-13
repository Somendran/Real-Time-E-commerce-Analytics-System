from fastapi.testclient import TestClient

from backend.app import app
from backend.routes import analytics


client = TestClient(app)


def test_metrics_returns_200(monkeypatch) -> None:
    monkeypatch.setattr(
        analytics,
        "fetch_one",
        lambda query, params=None: {"total_orders": 10, "total_revenue": 250.5},
    )

    response = client.get("/metrics")

    assert response.status_code == 200
    assert response.json()["data"]["total_orders"] == 10


def test_prediction_returns_valid_json(monkeypatch) -> None:
    monkeypatch.setattr(
        analytics,
        "predict_next_day",
        lambda: {"predicted_revenue": 321.0},
    )

    response = client.get("/prediction")

    assert response.status_code == 200
    assert response.json()["predicted_revenue"] == 321.0


def test_model_metrics_returns_valid_json(monkeypatch) -> None:
    monkeypatch.setattr(
        analytics,
        "load_model_metrics",
        lambda: {
            "mae": 10.0,
            "rmse": 12.0,
            "mape": 5.0,
            "last_trained_at": "2026-04-13T00:00:00+00:00",
        },
    )

    response = client.get("/model-metrics")

    assert response.status_code == 200
    assert response.json()["rmse"] == 12.0


def test_prediction_explanation_returns_valid_json(monkeypatch) -> None:
    monkeypatch.setattr(
        analytics,
        "explain_next_day_prediction",
        lambda: {
            "predicted_revenue": 321.0,
            "lower_bound": 300.0,
            "upper_bound": 350.0,
            "top_features": [{"feature": "lag_7", "value": 250.0, "impact": 12.5}],
            "global_feature_importance": [{"feature": "lag_7", "mean_abs_shap": 10.0}],
        },
    )

    response = client.get("/prediction-explanation")

    assert response.status_code == 200
    assert response.json()["top_features"][0]["feature"] == "lag_7"
