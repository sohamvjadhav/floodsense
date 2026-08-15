"""Live inference: Open-Meteo forecast feed → GRU → calibrated tier per district.

Loads the training artifact bundle (weights + normalization stats +
isotonic calibration + tier thresholds) and reproduces the training
feature pipeline exactly, so live inputs are transformed identically.
"""

import json
from functools import lru_cache
from pathlib import Path

import httpx
import numpy as np
import pandas as pd
import torch

from src.data.stations import STATIONS
from src.models.sequence_model import (HORIZONS, SEQ_FEATURES, STATIC_FEATURES,
                                       FloodGRU, add_upstream_lags)

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARTIFACTS = str(Path(__file__).resolve().parent.parent / "data" / "processed")


@lru_cache(maxsize=1)
def load_bundle():
    model = FloodGRU()
    model.load_state_dict(torch.load(f"{ARTIFACTS}/flood_gru_v1.pt",
                                     weights_only=True))
    model.eval()
    with open(f"{ARTIFACTS}/norm_stats.json") as f:
        stats = json.load(f)
    with open(f"{ARTIFACTS}/calibration.json") as f:
        calib = json.load(f)
    return model, stats, calib


def _isotonic_apply(p: float, xs: list, ys: list) -> float:
    """Step-function interpolation of a fitted isotonic regression."""
    return float(np.interp(p, xs, ys))


def fetch_live_daily(past_days: int = 10, forecast_days: int = 4) -> pd.DataFrame:
    """Past + forecast daily rainfall for all stations in one batched call."""
    lat = ",".join(str(s["lat"]) for s in STATIONS)
    lon = ",".join(str(s["lon"]) for s in STATIONS)
    params = {
        "latitude": lat, "longitude": lon,
        "daily": "precipitation_sum,precipitation_hours",
        "past_days": past_days, "forecast_days": forecast_days,
        "timezone": "Asia/Kolkata",
    }
    r = httpx.get(FORECAST_URL, params=params, timeout=60)
    r.raise_for_status()
    body = r.json()

    # multi-location response is a list of station objects
    locations = body if isinstance(body, list) else [body]
    frames = []
    for station, loc in zip(STATIONS, locations):
        d = loc["daily"]
        frames.append(pd.DataFrame({
            "station_id": station["station_id"],
            "district": station["district"],
            "date": pd.to_datetime(d["time"]),
            "rainfall_mm": d["precipitation_sum"],
            "precip_hours": d["precipitation_hours"],
        }))
    df = pd.concat(frames, ignore_index=True)

    # identical derived features as training
    df = df.sort_values(["station_id", "date"])
    static = pd.DataFrame(STATIONS)[["station_id", "elevation_m", "lat", "lon"]]
    df = df.merge(static, on="station_id")
    g = df.groupby("station_id")
    df["rain_3d_mm"] = g["rainfall_mm"].transform(lambda s: s.rolling(3, min_periods=1).sum())
    df["rain_7d_mm"] = g["rainfall_mm"].transform(lambda s: s.rolling(7, min_periods=1).sum())
    df = add_upstream_lags(df)
    df[["up_rain_lag1", "up_rain_lag2"]] = df[["up_rain_lag1", "up_rain_lag2"]].fillna(0.0)
    return df


def _fallback_tiers(df: pd.DataFrame, cutoff=None) -> dict:
    """IMD rainfall-threshold tiers when the model path is unavailable.

    Degraded mode so the API (and the live demo) never dies: severity from
    the last observed day's rainfall against IMD 24h classes plus 3-day
    accumulation. Entries are marked source="fallback".
    """
    cutoff = (pd.Timestamp.now(tz="Asia/Kolkata").tz_localize(None).normalize()
              if cutoff is None else pd.Timestamp(cutoff).normalize())
    out = {}
    for sid, g in df.groupby("station_id"):
        g = g.sort_values("date").reset_index(drop=True)
        end = int((g["date"] <= cutoff).sum()) - 1
        if end < 0:
            continue
        row = g.iloc[end]
        r24, r3 = float(row["rainfall_mm"]), float(row["rain_3d_mm"])
        tier = (3 if (r24 >= 204 or r3 >= 300)
                else 2 if (r24 >= 115 or r3 >= 200)
                else 1 if (r24 >= 64.4 or r3 >= 100)
                else 0)
        entry = {"district": row["district"], "station_id": sid,
                 "as_of": str(row["date"].date()), "source": "fallback"}
        for h in HORIZONS:
            entry[f"p{24*h}"] = round(min(1.0, (r24 + r3) / 300.0), 3)
            entry[f"tier{24*h}"] = tier
        out[sid] = entry
    return out


def predict_all(past_days: int = 10, forecast_days: int = 4) -> dict:
    """Return per-station calibrated probabilities + tiers for the window
    ending at the last OBSERVED day (forecast rain reserved for the
    dashboard's rainfall outlook, not fed to the model).

    Falls back to IMD rainfall thresholds if the model bundle or
    prediction fails — entries then carry source="fallback".
    """
    df = fetch_live_daily(past_days, forecast_days)
    try:
        return _predict_with_model(df)
    except Exception as e:  # noqa: BLE001 — degrade, never die
        print(f"[inference] model path failed ({type(e).__name__}: {e}); "
              f"using rainfall-threshold fallback")
        return _fallback_tiers(df)


def _predict_with_model(df: pd.DataFrame, cutoff=None) -> dict:
    model, stats, calib = load_bundle()

    seq_mu = pd.Series(stats["seq_mu"], index=SEQ_FEATURES)
    seq_sd = pd.Series(stats["seq_sd"], index=SEQ_FEATURES)
    st_mu = pd.Series(stats["st_mu"], index=STATIC_FEATURES)
    st_sd = pd.Series(stats["st_sd"], index=STATIC_FEATURES)

    window = 7
    cutoff = (pd.Timestamp.now(tz="Asia/Kolkata").tz_localize(None).normalize()
              if cutoff is None else pd.Timestamp(cutoff).normalize())
    out = {}
    for sid, g in df.groupby("station_id"):
        g = g.sort_values("date").reset_index(drop=True)
        # observed rows only — forecast rain feeds the dashboard outlook,
        # never the model input window
        end = int((g["date"] <= cutoff).sum()) - 1    # index of last observed day
        if end < window:
            continue
        seq = ((g.loc[end - window:end, SEQ_FEATURES] - seq_mu) / seq_sd).to_numpy(np.float32)
        stat = ((g.loc[0, STATIC_FEATURES].astype(float) - st_mu) / st_sd).to_numpy(np.float32)
        x = torch.from_numpy(seq[None, ...]), torch.from_numpy(stat[None, ...])
        with torch.no_grad():
            p = model(*x).numpy()[0]

        entry = {"district": g.loc[0, "district"], "station_id": sid,
                 "as_of": str(g.loc[end, "date"].date()), "source": "model"}
        for k, h in enumerate(HORIZONS):
            c = calib[f"{24*h}h"]
            p_cal = _isotonic_apply(float(p[k]), c["xs"], c["ys"])
            tier = int(np.digitize(p_cal, c["tiers"]))
            entry[f"p{24*h}"] = round(p_cal, 4)
            entry[f"tier{24*h}"] = tier
        out[sid] = entry
    return out


# ---------------------------------------------------------------- replay --
# Historical time-travel: run the SAME model on the unified dataset as of a
# past date, to demonstrate behavior on real flood days. The window only
# sees the 7 days BEFORE the cutoff — no future leakage into the replay.

HISTORY_CSV = f"{ARTIFACTS}/unified_daily.csv"

# Curated demonstration dates — verified present in the dataset with
# flood-class rainfall. Notes cite observed totals from the data itself.
REPLAY_EVENTS = [
    {"date": "2026-07-23", "name": "Palghar deluge",
     "note": "283mm in 24h · 537mm over 3 days"},
    {"date": "2026-07-06", "name": "Konkan multi-day event",
     "note": "400mm+ over 3 days, Raigad–Palghar"},
    {"date": "2024-06-09", "name": "Kolhapur monsoon-onset floods",
     "note": "242mm in 24h · 364mm over 3 days"},
    {"date": "2025-05-26", "name": "Pre-monsoon Konkan storm",
     "note": "Raigad 217mm, Sindhudurg 189mm next day"},
    {"date": "2025-08-19", "name": "Ratnagiri August deluge",
     "note": "156mm in 24h · 341mm over 3 days"},
    {"date": "2021-09-07", "name": "September Konkan rain",
     "note": "148mm in 24h · 277mm over 3 days"},
]


@lru_cache(maxsize=1)
def _history() -> pd.DataFrame | None:
    """Unified dataset with upstream lags, loaded once."""
    from pathlib import Path
    if not Path(HISTORY_CSV).exists():
        return None
    df = pd.read_csv(HISTORY_CSV, parse_dates=["date"])
    df = add_upstream_lags(df)
    df[["up_rain_lag1", "up_rain_lag2"]] = df[["up_rain_lag1", "up_rain_lag2"]].fillna(0.0)
    return df


def replay(date_str: str) -> dict:
    """Per-station risk as of a historical date, plus observed rainfall.

    Raises ValueError on malformed/unavailable dates.
    """
    df = _history()
    if df is None:
        raise ValueError("historical dataset not built — run src.data.build_dataset")
    cutoff = pd.Timestamp(date_str)
    if cutoff < df["date"].min() or cutoff > df["date"].max():
        raise ValueError(
            f"date outside dataset range {df['date'].min().date()} .. {df['date'].max().date()}")
    try:
        preds = _predict_with_model(df, cutoff)
    except Exception as e:  # noqa: BLE001
        print(f"[replay] model path failed ({type(e).__name__}: {e}); fallback tiers")
        preds = _fallback_tiers(df, cutoff)

    # observed conditions at the cutoff per station (last row <= cutoff)
    observed = {}
    for sid, g in df[df["date"] <= cutoff].groupby("station_id"):
        row = g.sort_values("date").iloc[-1]
        observed[sid] = {
            "observed_date": str(row["date"].date()),
            "rainfall_24h": round(float(row["rainfall_mm"]), 1),
            "rain_3d_mm": round(float(row["rain_3d_mm"]), 1),
            "rain_7d_mm": round(float(row["rain_7d_mm"]), 1),
            "flood_label": int(row["flood_label"]),
        }
    for sid, obs in observed.items():
        if sid in preds:
            preds[sid].update(obs)
    return preds


def replay_events() -> list[dict]:
    """Curated flood-day presets, annotated with observed peak rain."""
    df = _history()
    out = []
    for ev in REPLAY_EVENTS:
        entry = dict(ev)
        if df is not None:
            day = df[df["date"] == pd.Timestamp(ev["date"])]
            if len(day):
                peak = day.loc[day["rainfall_mm"].idxmax()]
                entry["peak_district"] = peak["district"]
                entry["peak_mm"] = round(float(peak["rainfall_mm"]), 1)
        out.append(entry)
    return out
