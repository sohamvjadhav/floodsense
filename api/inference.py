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


# ------------------------------------------------------ what-if + drivers --

def _norm_helpers(stats: dict):
    seq_mu = pd.Series(stats["seq_mu"], index=SEQ_FEATURES)
    seq_sd = pd.Series(stats["seq_sd"], index=SEQ_FEATURES)
    st_mu = pd.Series(stats["st_mu"], index=STATIC_FEATURES)
    st_sd = pd.Series(stats["st_sd"], index=STATIC_FEATURES)
    return seq_mu, seq_sd, st_mu, st_sd


def _predict_rows(rows: pd.DataFrame, stat_row: pd.Series, model, stats, calib) -> dict:
    """Predict from a prepared 7-row window + static row."""
    seq_mu, seq_sd, st_mu, st_sd = _norm_helpers(stats)
    seq = ((rows[SEQ_FEATURES] - seq_mu) / seq_sd).to_numpy(np.float32)
    stat = ((stat_row.astype(float) - st_mu) / st_sd).to_numpy(np.float32)
    x = torch.from_numpy(seq[None, ...]), torch.from_numpy(stat[None, ...])
    with torch.no_grad():
        p = model(*x).numpy()[0]
    out = {}
    for k, h in enumerate(HORIZONS):
        c = calib[f"{24*h}h"]
        p_cal = _isotonic_apply(float(p[k]), c["xs"], c["ys"])
        out[f"p{24*h}"] = round(p_cal, 4)
        out[f"tier{24*h}"] = int(np.digitize(p_cal, c["tiers"]))
    return out


def scenario(station_id: str, rain_mm: float) -> dict:
    """What-if: append a hypothetical rainy day to the live window and
    re-run the model — "if tomorrow rains X mm, how does risk move?"

    The synthetic day reuses the last known upstream lags (future
    upstream rain is unknowable) and assumes 12 rain-hours if wet.
    """
    from src.data.stations import STATION_BY_ID
    if station_id not in STATION_BY_ID:
        raise ValueError(f"unknown station: {station_id}")
    rain_mm = max(0.0, min(400.0, float(rain_mm)))
    df = fetch_live_daily()
    model, stats, calib = load_bundle()
    seq_mu, seq_sd, st_mu, st_sd = _norm_helpers(stats)

    g = df[df["station_id"] == station_id].sort_values("date").reset_index(drop=True)
    today = pd.Timestamp.now(tz="Asia/Kolkata").tz_localize(None).normalize()
    end = int((g["date"] <= today).sum()) - 1
    if end < 7:
        raise ValueError("insufficient live history for scenario")

    def _run(hypothetical_mm: float) -> dict:
        last7 = g.loc[end - 6:end].copy()
        prev = g.loc[end]
        synthetic = {
            "rainfall_mm": hypothetical_mm,
            "rain_3d_mm": float(prev["rainfall_mm"]) + float(g.loc[end - 1]["rainfall_mm"])
                          + hypothetical_mm,
            "rain_7d_mm": float(last7["rainfall_mm"].sum()) - float(last7["rainfall_mm"].iloc[-1])
                          + hypothetical_mm,
            "precip_hours": 12.0 if hypothetical_mm > 0 else 0.0,
            "up_rain_lag1": float(prev["up_rain_lag1"]),
            "up_rain_lag2": float(prev["up_rain_lag1"]),  # last known upstream
        }
        window = pd.concat(
            [last7.iloc[1:], pd.DataFrame([synthetic])], ignore_index=True)
        window = window[SEQ_FEATURES]
        res = _predict_rows(window, g.loc[0, STATIC_FEATURES], model, stats, calib)
        res["assumed_rain_mm"] = hypothetical_mm
        return res

    return {
        "station_id": station_id,
        "district": STATION_BY_ID[station_id]["district"],
        "as_of": str(g.loc[end, "date"].date()),
        "baseline": _run(0.0),
        "scenario": _run(rain_mm),
    }


def drivers(station_id: str, live_df: pd.DataFrame | None = None) -> dict:
    """Why is this district flagged: current rainfall inputs ranked
    against the same-calendar-month climatological distribution built
    from the 5-year dataset. Descriptive statistics only — no claims
    about the model's internal weights."""
    if live_df is None:
        live_df = fetch_live_daily()
    g = live_df[live_df["station_id"] == station_id].sort_values("date")
    today = pd.Timestamp.now(tz="Asia/Kolkata").tz_localize(None).normalize()
    row = g[g["date"] <= today].iloc[-1]

    hist = _history()
    out = {
        "rain_24h": round(float(row["rainfall_mm"]), 1),
        "rain_7d_mm": round(float(row["rain_7d_mm"]), 1),
        "upstream_rain_lag1": round(float(row["up_rain_lag1"]), 1),
        "upstream_rain_lag2": round(float(row["up_rain_lag2"]), 1),
    }
    if hist is not None:
        month = row["date"].month
        same_month = hist[hist["date"].dt.month == month]
        for key, col in (("rain_24h_pctile", "rainfall_mm"), ("rain_7d_pctile", "rain_7d_mm")):
            dist = same_month[col].dropna()
            if len(dist) > 30:
                out[key] = round(float((dist <= float(row[col])).mean() * 100), 1)
    return out
