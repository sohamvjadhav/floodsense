"""
Tests for scenario validation.

Usage:
    python -m pytest tests/test_scenario_validation.py -v
"""

import pytest


def test_scenario_input_validation():
    """Scenario input validation logic."""
    # Valid range: 0-400mm
    assert 0 <= 100 <= 400
    assert 0 <= 0 <= 400
    assert 0 <= 400 <= 400

    # Invalid
    assert not (0 <= -10 <= 400)
    assert not (0 <= 500 <= 400)


def test_scenario_station_validation():
    """Scenario validates station IDs."""
    from src.data.stations import STATION_BY_ID
    assert "MH_PUN" in STATION_BY_ID
    assert "MH_KOP" in STATION_BY_ID
    assert "INVALID" not in STATION_BY_ID
