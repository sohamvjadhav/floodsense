"""
Tests for feature generation and data pipeline.

Usage:
    python -m pytest tests/test_feature_generation.py -v
"""

import numpy as np
import pandas as pd
import pytest

from src.data.stations import STATIONS, STATION_BY_ID
from src.models.sequence_model import add_upstream_lags, SEQ_FEATURES


@pytest.fixture
def sample_df():
    """Create a minimal dataset for testing."""
    dates = pd.date_range("2024-01-01", periods=10)
    # Use stations where upstream relationships are self-contained in the set
    stations = ["MH_NBR", "MH_DHU", "MH_JLG"]
    rows = []
    for sid in stations:
        for d in dates:
            rows.append({
                "station_id": sid,
                "date": d,
                "rainfall_mm": np.random.uniform(0, 50),
                "rain_3d_mm": np.random.uniform(0, 100),
                "rain_7d_mm": np.random.uniform(0, 200),
                "precip_hours": np.random.uniform(0, 12),
                "elevation_m": 500,
                "lat": 18.0,
                "lon": 74.0,
                "flood_label": 0,
                "data_confidence": "measured",
            })
    return pd.DataFrame(rows)


def test_station_registry():
    """All stations have required fields."""
    required = {"station_id", "district", "basin", "lat", "lon",
                "elevation_m", "population", "upstream_ids"}
    for s in STATIONS:
        assert required.issubset(s.keys()), f"missing fields in {s['station_id']}"


def test_station_ids_unique():
    """Station IDs are unique."""
    ids = [s["station_id"] for s in STATIONS]
    assert len(ids) == len(set(ids))


def test_upstream_references_valid():
    """All upstream_ids reference existing stations."""
    all_ids = {s["station_id"] for s in STATIONS}
    for s in STATIONS:
        for up_id in s["upstream_ids"]:
            assert up_id in all_ids, f"{s['station_id']} references unknown upstream {up_id}"


def test_add_upstream_lags(sample_df):
    """Upstream lag computation produces expected columns."""
    result = add_upstream_lags(sample_df)
    assert "up_rain_lag1" in result.columns
    assert "up_rain_lag2" in result.columns
    assert not result["up_rain_lag1"].isna().any()
    assert not result["up_rain_lag2"].isna().any()


def test_upstream_lags_non_negative(sample_df):
    """Upstream lag values are non-negative (rainfall can't be negative)."""
    result = add_upstream_lags(sample_df)
    assert (result["up_rain_lag1"] >= 0).all()
    assert (result["up_rain_lag2"] >= 0).all()


def test_seq_features_complete():
    """SEQ_FEATURES list matches expected features."""
    expected = ["rainfall_mm", "rain_3d_mm", "rain_7d_mm", "precip_hours",
                "up_rain_lag1", "up_rain_lag2"]
    assert SEQ_FEATURES == expected
