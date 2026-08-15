"""
Build the unified FloodSense dataset.

Pulls daily historical rainfall from the Open-Meteo Archive API
(free, no key) for each station in src/data/stations.py, derives
rolling features, and writes data/processed/unified_daily.csv in the
project schema:

    station_id, district, state, lat, lon, date, rainfall_mm,
    river_discharge_m3s, water_level_m, elevation_m,
    upstream_station_ids, flood_label, data_confidence

IMPORTANT — labeling caveat:
    flood_label here is a HEURISTIC proxy ( IMD-style extreme-rainfall rule:
    24h rainfall >= 115mm combined with antecedent wetness ), clearly flagged
    so it can be swapped for INDOFLOODS event labels when that dataset is
    downloaded and joined. Every downstream metric must be re-run after the
    label swap; the report must present these numbers as pipeline-validation
    results, not final flood-prediction performance.

    data_confidence is 'measured' for raw API rainfall and 'interpolated'
    for any gap-filled day, so interpolation is never silent.

Usage:
    python -m src.data.build_dataset --years 5
"""

import argparse
import time
from datetime import date, timedelta

import pandas as pd
import requests

from .stations import STATIONS

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

# IMD 24h rainfall classes (mm): used both as features and for the
# heuristic label threshold.
EXTREME_RAIN_MM = 115.0   # IMD "extremely heavy"
HEAVY_RAIN_MM = 64.4      # IMD "heavy"

STATE = "Maharashtra"


def fetch_station_daily(station: dict, start: str, end: str) -> pd.DataFrame:
    params = {
        "latitude": station["lat"],
        "longitude": station["lon"],
        "start_date": start,
        "end_date": end,
        # NOTE: the archive API has no daily soil-moisture variable and
        # river_discharge returns nulls over India (GloFAS is a separate
        # endpoint) — discharge/water_level stay placeholder columns until
        # CWC gauge data is joined. Never silently filled.
        "daily": "precipitation_sum,precipitation_hours",
        "timezone": "Asia/Kolkata",
    }
    resp = requests.get(ARCHIVE_URL, params=params, timeout=60)
    resp.raise_for_status()
    daily = resp.json()["daily"]
    df = pd.DataFrame(daily)
    df = df.rename(columns={
        "time": "date",
        "precipitation_sum": "rainfall_mm",
        "precipitation_hours": "precip_hours",
    })
    df["date"] = pd.to_datetime(df["date"])
    return df


def build(years: int, out_path: str) -> pd.DataFrame:
    end = date.today() - timedelta(days=3)   # archive API lags ~2-3 days
    start = end - timedelta(days=365 * years)

    frames = []
    for s in STATIONS:
        print(f"fetching {s['station_id']} ({s['district']}) ...")
        df = fetch_station_daily(s, start.isoformat(), end.isoformat())
        df["station_id"] = s["station_id"]
        df["district"] = s["district"]
        frames.append(df)
        time.sleep(1.0)   # be polite to the free API

    df = pd.concat(frames, ignore_index=True)

    # --- missing-data handling: flag, don't silently interpolate ---
    df["data_confidence"] = "measured"
    for col in ["rainfall_mm", "precip_hours"]:
        gap = df[col].isna()
        if gap.any():
            df.loc[gap, "data_confidence"] = "interpolated"
            # fill within-station by time interpolation only for feature use;
            # the flag above keeps the interpolation explicit
            df[col] = (df.groupby("station_id")[col]
                         .transform(lambda g: g.interpolate(limit_direction="both")))
        df[col] = df[col].fillna(0.0)

    # --- derived features ---
    df = df.sort_values(["station_id", "date"])
    g = df.groupby("station_id")
    df["rain_3d_mm"] = g["rainfall_mm"].transform(lambda s: s.rolling(3, min_periods=1).sum())
    df["rain_7d_mm"] = g["rainfall_mm"].transform(lambda s: s.rolling(7, min_periods=1).sum())
    # river_discharge_m3s: not available from archive API over India (null) —
    # kept as explicit zero placeholder until CWC gauge join.
    df["river_discharge_m3s"] = 0.0
    df["water_level_m"] = 0.0   # placeholder until CWC gauge data is joined

    # --- heuristic flood label: sustained or extreme rainfall ---
    # flood-risk day := 24h rainfall >= 115mm (IMD "extremely heavy")
    #                OR 3-day accumulation >= 150mm (sustained heavy rain
    #                   saturating soil/overwhelming drainage)
    # (proxy for INDOFLOODS event labels — see module docstring)
    df["flood_label"] = ((df["rainfall_mm"] >= EXTREME_RAIN_MM) |
                         (df["rain_3d_mm"] >= 150.0)).astype(int)

    # attach static station attributes
    static = pd.DataFrame(STATIONS)
    static["state"] = STATE
    static["upstream_station_ids"] = static["upstream_ids"].apply(lambda v: ";".join(v))
    df = df.merge(static[["station_id", "state", "lat", "lon", "elevation_m",
                          "basin", "upstream_station_ids"]], on="station_id")

    cols = ["station_id", "district", "state", "lat", "lon", "date",
            "rainfall_mm", "rain_3d_mm", "rain_7d_mm", "precip_hours",
            "river_discharge_m3s", "water_level_m", "elevation_m",
            "basin", "upstream_station_ids", "flood_label", "data_confidence"]
    df = df[cols]

    df.to_csv(out_path, index=False)
    n_pos = int(df["flood_label"].sum())
    print(f"\nwrote {out_path}: {len(df)} rows, {df['station_id'].nunique()} stations, "
          f"{n_pos} flood-label days ({100*n_pos/len(df):.2f}% positive)")
    return df


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", type=int, default=5)
    ap.add_argument("--out", default="data/processed/unified_daily.csv")
    args = ap.parse_args()
    build(args.years, args.out)
