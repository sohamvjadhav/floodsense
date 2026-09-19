"""
Tests for temporal splitting — no future leakage.

Usage:
    python -m pytest tests/test_temporal_split.py -v
"""

import numpy as np
import pandas as pd
import pytest

from src.models.splits import time_split, time_split_with_buffer, get_split_dates


@pytest.fixture
def time_series_df():
    """Create a time-series dataset spanning 100 days."""
    dates = pd.date_range("2024-01-01", periods=100)
    rows = []
    for d in dates:
        for sid in ["MH_PUN", "MH_KOP"]:
            rows.append({
                "station_id": sid,
                "date": d,
                "rainfall_mm": np.random.uniform(0, 50),
                "flood_label": int(np.random.random() < 0.05),
            })
    return pd.DataFrame(rows)


def test_time_split_chronological(time_series_df):
    """Splits are strictly chronological."""
    train, val, test = time_split(time_series_df)
    assert train["date"].max() <= val["date"].min()
    assert val["date"].max() <= test["date"].min()


def test_time_split_ratio(time_series_df):
    """Splits respect approximate ratios."""
    train, val, test = time_split(time_series_df)
    total = len(time_series_df["date"].unique())
    train_pct = len(train["date"].unique()) / total
    val_pct = len(val["date"].unique()) / total
    test_pct = len(test["date"].unique()) / total
    assert 0.65 <= train_pct <= 0.75
    assert 0.10 <= val_pct <= 0.20
    assert 0.10 <= test_pct <= 0.20


def test_no_future_leakage(time_series_df):
    """Training data contains no dates from validation/test."""
    train, val, test = time_split(time_series_df)
    train_dates = set(train["date"].unique())
    val_dates = set(val["date"].unique())
    test_dates = set(test["date"].unique())
    assert len(train_dates & val_dates) == 0
    assert len(train_dates & test_dates) == 0
    assert len(val_dates & test_dates) == 0


def test_split_with_buffer(time_series_df):
    """Buffer split excludes horizon days at boundaries."""
    train, val, test = time_split_with_buffer(time_series_df, max_horizon=3)
    # Train and val should not overlap
    train_dates = set(train["date"].unique())
    val_dates = set(val["date"].unique())
    assert len(train_dates & val_dates) == 0


def test_get_split_dates(time_series_df):
    """Split dates metadata is correct."""
    info = get_split_dates(time_series_df)
    assert info["total_dates"] == 100
    assert "train_end" in info
    assert "val_end" in info
    assert info["train_days"] + info["val_days"] + info["test_days"] == 100
