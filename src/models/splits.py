"""
Temporal data splitting with horizon-buffer safety.

Ensures no future observation leaks into training, and labels at longer
horizons don't cross split boundaries.

Usage:
    from src.models.splits import time_split_with_buffer
"""

import pandas as pd
import numpy as np


def time_split(df: pd.DataFrame, train_ratio: float = 0.70,
               val_ratio: float = 0.15) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Chronological split on unique dates: 70/15/15 train/val/test."""
    dates = sorted(df["date"].unique())
    n = len(dates)
    train_end = dates[int(n * train_ratio)]
    val_end = dates[int(n * (train_ratio + val_ratio))]
    train = df[df["date"] <= train_end]
    val = df[(df["date"] > train_end) & (df["date"] <= val_end)]
    test = df[df["date"] > val_end]
    return train, val, test


def time_split_with_buffer(df: pd.DataFrame, max_horizon: int = 3,
                           train_ratio: float = 0.70,
                           val_ratio: float = 0.15) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Chronological split with horizon-day buffer at boundaries.

    The last `max_horizon` days of each split are excluded from that split
    to prevent label cross-boundary leakage. For example, with max_horizon=3,
    the last 3 days of the training period are dropped because their 72h
    labels would extend into the validation period.
    """
    dates = sorted(df["date"].unique())
    n = len(dates)
    train_end_idx = int(n * train_ratio)
    val_end_idx = int(n * (train_ratio + val_ratio))

    train_end = dates[train_end_idx]
    val_end = dates[val_end_idx]

    # Apply buffer: drop last max_horizon days from each split
    buffer_train_end = dates[max(0, train_end_idx - max_horizon)]
    buffer_val_end = dates[max(0, val_end_idx - max_horizon)]

    train = df[df["date"] <= buffer_train_end]
    val = df[(df["date"] > train_end) & (df["date"] <= buffer_val_end)]
    test = df[df["date"] > val_end]

    return train, val, test


def chronological_order(df: pd.DataFrame) -> pd.DataFrame:
    """Sort dataframe by date within each station."""
    return df.sort_values(["station_id", "date"]).reset_index(drop=True)


def get_split_dates(df: pd.DataFrame, train_ratio: float = 0.70,
                    val_ratio: float = 0.15) -> dict:
    """Return the split boundary dates for documentation."""
    dates = sorted(df["date"].unique())
    n = len(dates)
    return {
        "total_dates": n,
        "train_end": str(dates[int(n * train_ratio)].date()) if hasattr(dates[0], 'date') else str(dates[int(n * train_ratio)])[:10],
        "val_end": str(dates[int(n * (train_ratio + val_ratio))].date()) if hasattr(dates[0], 'date') else str(dates[int(n * (train_ratio + val_ratio))])[:10],
        "test_start": str(dates[int(n * (train_ratio + val_ratio)) + 1].date()) if hasattr(dates[0], 'date') else str(dates[int(n * (train_ratio + val_ratio)) + 1])[:10],
        "train_days": int(n * train_ratio),
        "val_days": int(n * val_ratio),
        "test_days": n - int(n * train_ratio) - int(n * val_ratio),
    }
