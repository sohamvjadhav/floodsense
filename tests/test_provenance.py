"""
Batch-1: provenance (mode/source/as-of/stale) + bilingual guidance.

Usage:
    python -m pytest tests/test_provenance.py -v
"""

import pytest
from fastapi.testclient import TestClient

from api.alerts import build_alert_message
from api.main import MODE, _provenance, app


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


def test_mode_is_experimental():
    assert MODE == "experimental_rain_risk"


def test_provenance_fresh():
    from datetime import date, timedelta
    today = date.today().isoformat()
    p = _provenance(today, "model")
    assert p["mode"] == "experimental_rain_risk"
    assert p["is_stale"] is False


def test_provenance_stale():
    p = _provenance("2020-01-01", "model")
    assert p["is_stale"] is True


def test_provenance_missing_as_of_is_stale():
    p = _provenance(None, "model")
    assert p["is_stale"] is True


def test_alert_english_is_experimental():
    msg = build_alert_message("Pune", 3, 0.8)
    assert "EXPERIMENTAL" in msg
    assert "EVACUATE" not in msg
    assert "official" in msg.lower()


def test_alert_marathi():
    msg = build_alert_message("Pune", 2, 0.5, lang="mr")
    assert "प्रायोगिक" in msg
    assert "अधिकृत" in msg


def test_health_carries_mode(client):
    data = client.get("/api/health").json()
    assert data["mode"] == "experimental_rain_risk"
    assert data["calibration_status"] == "disabled-provisional"


def test_model_info_no_isotonic_claim(client):
    data = client.get("/api/model/info").json()
    assert data["calibration"] == "disabled-provisional"
    assert data["mode"] == "experimental_rain_risk"
    assert "heuristic" in data["label_source"]


def test_risk_map_carries_provenance(client):
    data = client.get("/api/risk/map").json()
    assert data["mode"] == "experimental_rain_risk"
    assert "stale_count" in data
    assert "provenance" in data["districts"][0]
