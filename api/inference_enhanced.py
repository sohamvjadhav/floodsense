"""
Enhanced inference with richer explainability, data quality indicators,
and model status tracking.

Extends api/inference.py with:
- Data quality assessment per prediction
- Model vs fallback status
- Stale data detection
- Enhanced risk drivers with confidence

Usage:
    from api.inference_enhanced import predict_all_enhanced
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from .inference import (load_bundle, fetch_live_daily, _predict_with_model,
                        _fallback_tiers, _isotonic_apply, _history,
                        HORIZONS, SEQ_FEATURES, STATIC_FEATURES)
from src.data.stations import STATIONS, STATION_BY_ID


def assess_data_quality(df: pd.DataFrame, station_id: str,
                        cutoff: pd.Timestamp) -> dict:
    """Assess data quality for a specific station's prediction."""
    g = df[df["station_id"] == station_id].sort_values("date")
    recent = g[g["date"] <= cutoff].tail(7)

    if len(recent) == 0:
        return {"confidence": "no_data", "missing_sources": ["rainfall"],
                "freshness_hours": None}

    # Check for interpolated data
    n_interpolated = (recent.get("data_confidence", pd.Series(["measured"] * len(recent)))
                      == "interpolated").sum() if "data_confidence" in recent.columns else 0

    # Check data freshness
    last_date = recent["date"].max()
    now = pd.Timestamp.now(tz="Asia/Kolkata").tz_localize(None)
    freshness_hours = (now - last_date).total_seconds() / 3600

    # Check missing features
    missing = []
    for col in ["river_discharge_m3s", "water_level_m"]:
        if col in recent.columns and (recent[col] == 0.0).all():
            missing.append(col)

    # Determine confidence
    if n_interpolated > 3:
        confidence = "low"
    elif n_interpolated > 0 or freshness_hours > 24:
        confidence = "medium"
    else:
        confidence = "high"

    return {
        "confidence": confidence,
        "missing_sources": missing,
        "interpolated_days": int(n_interpolated),
        "freshness_hours": round(freshness_hours, 1),
        "last_data_date": str(last_date.date()),
    }


def enhanced_drivers(station_id: str, live_df: pd.DataFrame,
                     model_probs: dict) -> list[str]:
    """Generate human-readable risk driver explanations."""
    drivers = []
    g = live_df[live_df["station_id"] == station_id].sort_values("date")
    today = pd.Timestamp.now(tz="Asia/Kolkata").tz_localize(None).normalize()
    row = g[g["date"] <= today].iloc[-1] if len(g[g["date"] <= today]) else g.iloc[-1]

    # Rainfall drivers
    rain_24h = float(row["rainfall_mm"])
    rain_3d = float(row["rain_3d_mm"])
    rain_7d = float(row["rain_7d_mm"])

    if rain_24h >= 115:
        drivers.append(f"Extreme 24h rainfall ({rain_24h:.0f}mm — IMD extremely heavy)")
    elif rain_24h >= 64.4:
        drivers.append(f"Heavy 24h rainfall ({rain_24h:.0f}mm — IMD heavy)")

    if rain_3d >= 150:
        drivers.append(f"High 3-day accumulation ({rain_3d:.0f}mm — soil saturation risk)")
    elif rain_3d >= 100:
        drivers.append(f"Elevated 3-day accumulation ({rain_3d:.0f}mm)")

    if rain_7d >= 200:
        drivers.append(f"Sustained 7-day rainfall ({rain_7d:.0f}mm — antecedent wetness)")

    # Upstream drivers
    up_lag1 = float(row.get("up_rain_lag1", 0))
    up_lag2 = float(row.get("up_rain_lag2", 0))
    if up_lag1 > 50:
        drivers.append(f"Elevated upstream rainfall yesterday ({up_lag1:.0f}mm)")
    if up_lag2 > 50:
        drivers.append(f"Upstream rainfall 2 days ago ({up_lag2:.0f}mm)")

    # Probability-based drivers
    p24 = model_probs.get("p24", 0)
    if p24 > 0.7:
        drivers.append(f"High model confidence (24h probability: {p24:.0%})")
    elif p24 > 0.4:
        drivers.append(f"Moderate model confidence (24h probability: {p24:.0%})")

    if not drivers:
        drivers.append("No significant risk drivers identified")

    return drivers


def predict_all_enhanced(past_days: int = 10, forecast_days: int = 4) -> dict:
    """Enhanced prediction with data quality and status indicators."""
    df = fetch_live_daily(past_days, forecast_days)

    # Try model path first
    model_status = "model"
    try:
        preds = _predict_with_model(df)
    except Exception as e:
        print(f"[inference_enhanced] model failed ({e}), using fallback")
        preds = _fallback_tiers(df)
        model_status = "fallback"

    # Enhance each prediction with data quality and drivers
    cutoff = pd.Timestamp.now(tz="Asia/Kolkata").tz_localize(None).normalize()
    enhanced = {}

    for sid, pred in preds.items():
        quality = assess_data_quality(df, sid, cutoff)
        drivers = enhanced_drivers(sid, df, pred)

        # Staleness check
        freshness = quality.get("freshness_hours")
        is_stale = freshness is not None and freshness > 6  # hours

        enhanced[sid] = {
            **pred,
            "data_quality": quality,
            "drivers": drivers,
            "model_status": model_status,
            "is_stale": is_stale,
            "prediction_source": model_status,
        }

    return enhanced


def get_model_info() -> dict:
    """Return model metadata for the /api/model/info endpoint."""
    try:
        model, stats, calib = load_bundle()
        n_params = sum(p.numel() for p in model.parameters())
        return {
            "model_type": "FloodGRU",
            "version": "v1",
            "parameters": n_params,
            "window_days": 7,
            "horizons": [24, 48, 72],
            "features": SEQ_FEATURES,
            "static_features": STATIC_FEATURES,
            "calibration": "isotonic",
            "training_split": "chronological 70/15/15",
            "status": "loaded",
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}
