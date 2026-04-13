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
