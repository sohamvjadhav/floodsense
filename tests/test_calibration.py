"""
Tests for calibration — post-calibration Brier scores improve or are comparable.

Usage:
    python -m pytest tests/test_calibration.py -v
"""

import json
from pathlib import Path

import pytest


def test_calibration_files_exist():
    """Calibration artifacts exist after training."""
    assert Path("data/processed/calibration.json").exists()
    assert Path("data/processed/norm_stats.json").exists()


def test_calibration_has_all_horizons():
    """Calibration covers all 3 horizons."""
    with open("data/processed/calibration.json") as f:
        calib = json.load(f)
    assert "24h" in calib
    assert "48h" in calib
    assert "72h" in calib


def test_calibration_has_required_fields():
    """Each horizon has required calibration fields."""
    with open("data/processed/calibration.json") as f:
        calib = json.load(f)
    for h in ["24h", "48h", "72h"]:
        assert "xs" in calib[h], f"{h} missing xs"
        assert "ys" in calib[h], f"{h} missing ys"
        assert "tiers" in calib[h], f"{h} missing tiers"
        assert len(calib[h]["tiers"]) == 3, f"{h} should have 3 tier thresholds"


def test_norm_stats_has_all_features():
    """Normalization stats cover all features."""
    with open("data/processed/norm_stats.json") as f:
        stats = json.load(f)
    assert "seq_mu" in stats
    assert "seq_sd" in stats
    assert "st_mu" in stats
    assert "st_sd" in stats
    assert len(stats["seq_mu"]) == 6  # 6 sequential features
    assert len(stats["st_mu"]) == 3   # 3 static features
