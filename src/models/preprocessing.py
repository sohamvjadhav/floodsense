"""
Preprocessing: fit scalers on training data only, transform all splits.

Prevents normalization leakage where test-period statistics influence
feature scaling.

Usage:
    from src.models.preprocessing import fit_transform_splits
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler


def fit_transform_splits(train: pd.DataFrame, val: pd.DataFrame,
                         test: pd.DataFrame, features: list[str],
                         static_features: list[str] = None) -> dict:
    """Fit StandardScaler on training data, transform all splits.

    Returns dict with transformed dataframes, scaler objects, and
    normalization stats for inference reproducibility.
    """
    # Fit on training data only
    scaler = StandardScaler()
    scaler.fit(train[features])

    # Transform all splits
    train_scaled = train.copy()
    val_scaled = val.copy()
    test_scaled = test.copy()

    train_scaled[features] = scaler.transform(train[features])
    val_scaled[features] = scaler.transform(val[features])
    test_scaled[features] = scaler.transform(test[features])

    # Static features (if any)
    static_scaler = None
    if static_features:
        static_scaler = StandardScaler()
        static_scaler.fit(train[static_features])
        train_scaled[static_features] = static_scaler.transform(train[static_features])
        val_scaled[static_features] = static_scaler.transform(val[static_features])
        test_scaled[static_features] = static_scaler.transform(test[static_features])

    stats = {
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "feature_names": features,
    }
    if static_scaler:
        stats["static_mean"] = static_scaler.mean_.tolist()
        stats["static_scale"] = static_scaler.scale_.tolist()
        stats["static_feature_names"] = static_features

    return {
        "train": train_scaled,
        "val": val_scaled,
        "test": test_scaled,
        "scaler": scaler,
        "static_scaler": static_scaler,
        "stats": stats,
    }


def save_norm_stats(stats: dict, out_path: str):
    """Save normalization statistics for inference reproducibility."""
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(stats, f, indent=2)


def load_norm_stats(in_path: str) -> dict:
    """Load normalization statistics."""
    with open(in_path) as f:
        return json.load(f)
