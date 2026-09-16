"""
Tests for missing data handling and unknown stations.

Usage:
    python -m pytest tests/test_missing_data.py -v
"""

import numpy as np
import pandas as pd
import pytest

from src.data.stations import STATIONS, STATION_BY_ID


def test_all_stations_have_required_fields():
    """Every station has all required fields."""
    required_keys = {"station_id", "district", "basin", "lat", "lon",
                     "elevation_m", "population", "upstream_ids"}
    for s in STATIONS:
        for key in required_keys:
            assert key in s, f"{s.get('station_id', '?')} missing {key}"


def test_station_coordinates_reasonable():
    """Station coordinates are within Maharashtra bounds."""
    for s in STATIONS:
        assert 15.0 <= s["lat"] <= 22.0, f"{s['station_id']} lat out of range"
        assert 72.0 <= s["lon"] <= 81.0, f"{s['station_id']} lon out of range"


def test_elevation_non_negative():
    """Elevation is non-negative."""
    for s in STATIONS:
        assert s["elevation_m"] >= 0, f"{s['station_id']} negative elevation"


def test_population_positive():
    """Population is positive."""
    for s in STATIONS:
        assert s["population"] > 0, f"{s['station_id']} zero population"


def test_upstream_ids_are_list():
    """upstream_ids is a list."""
    for s in STATIONS:
        assert isinstance(s["upstream_ids"], list), f"{s['station_id']} upstream_ids not list"


def test_station_by_id_lookup():
    """Station lookup dict works correctly."""
    for s in STATIONS:
        assert s["station_id"] in STATION_BY_ID
        assert STATION_BY_ID[s["station_id"]]["district"] == s["district"]


def test_basins_are_valid():
    """All basins are from the expected set."""
    valid_basins = {"Godavari", "Krishna", "Konkan", "Tapi"}
    for s in STATIONS:
        assert s["basin"] in valid_basins, f"{s['station_id']} unknown basin {s['basin']}"


def test_no_duplicate_station_ids():
    """No duplicate station IDs."""
    ids = [s["station_id"] for s in STATIONS]
    assert len(ids) == len(set(ids))
