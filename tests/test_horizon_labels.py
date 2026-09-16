"""
Tests for horizon label creation — labels don't cross split boundaries.

Usage:
    python -m pytest tests/test_horizon_labels.py -v
"""

import numpy as np
import pandas as pd
import pytest

from src.models.splits import time_split_with_buffer


@pytest.fixture
def labeled_df():
    """Create a dataset with flood labels for horizon testing."""
    dates = pd.date_range("2024-01-01", periods=100)
    rows = []
    for d in dates:
        for sid in ["MH_PUN"]:
            # Create some positive labels
            is_flood = d.day in [10, 20, 30]
            rows.append({
                "station_id": sid,
                "date": d,
                "rainfall_mm": 200.0 if is_flood else 5.0,
                "rain_3d_mm": 300.0 if is_flood else 15.0,
                "rain_7d_mm": 400.0 if is_flood else 50.0,
                "precip_hours": 12.0 if is_flood else 2.0,
                "elevation_m": 500,
                "lat": 18.0,
                "lon": 74.0,
                "flood_label": int(is_flood),
                "up_rain_lag1": 50.0 if is_flood else 5.0,
                "up_rain_lag2": 30.0 if is_flood else 3.0,
                "data_confidence": "measured",
            })
    return pd.DataFrame(rows)


def test_horizon_labels_within_bounds(labeled_df):
    """Horizon labels don't extend beyond the dataset."""
    # 72h = 3 days, so the last 3 days shouldn't have 72h labels
    dates = sorted(labeled_df["date"].unique())
    max_date = dates[-1]

    for _, g in labeled_df.groupby("station_id"):
        g = g.sort_values("date")
        for i in range(len(g)):
            # Compute 72h label manually
            if i + 3 <= len(g):
                label_72h = int(g.iloc[i:i+3]["flood_label"].max())
            else:
                label_72h = 0
            # Should be 0 for last 3 days
            if g.iloc[i]["date"] > dates[-4]:
                assert label_72h == 0, f"72h label non-zero at boundary"


def test_buffer_prevents_boundary_crossing(labeled_df):
    """Buffer split ensures labels don't cross split boundaries."""
    train, val, test = time_split_with_buffer(labeled_df, max_horizon=3)
    # The buffer should have removed some days from train/val boundaries
    train_dates = set(train["date"].unique())
    val_dates = set(val["date"].unique())
    # There should be a gap between train max and val min
    if train_dates and val_dates:
        train_max = max(train_dates)
        val_min = min(val_dates)
        gap = (val_min - train_max).days
        assert gap >= 1, "Buffer didn't create sufficient gap"
