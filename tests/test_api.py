"""
Tests for API endpoints.

Usage:
    python -m pytest tests/test_api.py -v
"""

import pytest
from fastapi.testclient import TestClient

from api.main import app


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app, raise_server_exceptions=False)


def test_health_endpoint(client):
    """Health endpoint returns ok."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


def test_risk_map_endpoint(client):
    """Risk map endpoint returns district data."""
    resp = client.get("/api/risk/map")
    assert resp.status_code == 200
    data = resp.json()
    assert "districts" in data
    assert "impact" in data
    assert "legend" in data
    assert len(data["districts"]) > 0


def test_risk_map_invalid_horizon(client):
    """Risk map rejects invalid horizon."""
    resp = client.get("/api/risk/map?horizon=12")
    assert resp.status_code == 422


def test_risk_map_horizons(client):
    """Risk map works for all valid horizons."""
    for h in [24, 48, 72]:
        resp = client.get(f"/api/risk/map?horizon={h}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["impact"]["horizon"] == h


def test_risk_district_known(client):
    """District detail for known district."""
    resp = client.get("/api/risk/Pune")
    # May return 503 if no inference yet, but should not crash
    assert resp.status_code in (200, 503)


def test_risk_district_unknown(client):
    """District detail for unknown district returns 404."""
    resp = client.get("/api/risk/NonexistentDistrict")
    assert resp.status_code == 404


def test_replay_events(client):
    """Replay events endpoint returns event list."""
    resp = client.get("/api/risk/replay/events")
    assert resp.status_code == 200
    data = resp.json()
    assert "events" in data
    assert isinstance(data["events"], list)


def test_subscribe_validation(client):
    """Subscription validates phone format."""
    resp = client.post("/api/alerts/subscribe", json={
        "phone": "12345",
        "district": "Pune"
    })
    assert resp.status_code == 422  # validation error


def test_subscribe_valid(client):
    """Valid subscription request."""
    resp = client.post("/api/alerts/subscribe", json={
        "phone": "+919812345678",
        "district": "Pune"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True


def test_subscribe_unknown_district(client):
    """Subscription with unknown district."""
    resp = client.post("/api/alerts/subscribe", json={
        "phone": "+919812345678",
        "district": "NonexistentDistrict"
    })
    assert resp.status_code == 422


def test_scenario_validation(client):
    """Scenario validates inputs."""
    resp = client.post("/api/risk/scenario", json={
        "station_id": "MH_PUN",
        "rain_mm": -10
    })
    assert resp.status_code == 422

    resp = client.post("/api/risk/scenario", json={
        "station_id": "MH_PUN",
        "rain_mm": 500
    })
    assert resp.status_code == 422
