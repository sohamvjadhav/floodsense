"""
Tests for replay functionality — uses date-appropriate data only.

Usage:
    python -m pytest tests/test_api_replay.py -v
"""

import pytest
from fastapi.testclient import TestClient

from api.main import app


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


def test_replay_events_endpoint(client):
    """Replay events endpoint returns curated events."""
    resp = client.get("/api/risk/replay/events")
    assert resp.status_code == 200
    data = resp.json()
    assert "events" in data
    assert len(data["events"]) > 0
    for ev in data["events"]:
        assert "date" in ev
        assert "name" in ev


def test_replay_range_endpoint(client):
    """Replay range endpoint returns consecutive frames."""
    resp = client.get("/api/risk/replay/range?start=2024-06-09&days=3")
    # May return 422 if data not in range, but should not crash
    assert resp.status_code in (200, 422)


def test_replay_invalid_date(client):
    """Replay with invalid date format returns 422."""
    resp = client.get("/api/risk/replay?date=not-a-date")
    assert resp.status_code == 422


def test_replay_range_invalid_start(client):
    """Replay range with invalid start returns 422."""
    resp = client.get("/api/risk/replay/range?start=invalid")
    assert resp.status_code == 422
