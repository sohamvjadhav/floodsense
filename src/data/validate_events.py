"""
Validate the event-label dataset: quality checks, consistency, and reporting.

Usage:
    python -m src.data.validate_events
"""

import argparse
import json
from pathlib import Path

import pandas as pd

from .events import load_events
from .stations import STATION_BY_ID


def validate_dataset(csv_path: str, events_csv: str = None) -> dict:
    """Run quality checks on the labeled dataset."""
    df = pd.read_csv(csv_path, parse_dates=["date"])
    events = load_events(events_csv)
    issues = []
    warnings = []

    # 1. Check for unknown stations
    known = set(STATION_BY_ID.keys())
    unknown = set(df["station_id"].unique()) - known
    if unknown:
        issues.append(f"unknown stations in dataset: {unknown}")

    # 2. Check date continuity per station
    for sid, g in df.groupby("station_id"):
        dates = sorted(g["date"].unique())
        if len(dates) < 2:
            continue
        gaps = []
        for i in range(1, len(dates)):
            diff = (dates[i] - dates[i - 1]).days
            if diff > 1:
                gaps.append((str(dates[i - 1].date()), str(dates[i].date()), diff))
        if gaps:
            warnings.append(f"{sid}: {len(gaps)} date gaps (max {max(g[2] for g in gaps)} days)")

    # 3. Check label consistency
    if "v_label_24h" in df.columns:
        # v_label_24h should be a subset of v_label_48h which is subset of v_label_72h
        inconsistent = (
            (df["v_label_24h"] > df["v_label_48h"]) |
            (df["v_label_48h"] > df["v_label_72h"])
        ).sum()
        if inconsistent > 0:
            issues.append(f"{inconsistent} rows with inconsistent horizon labels")

    # 4. Check for missing values in critical columns
    critical = ["station_id", "date", "rainfall_mm", "flood_label"]
    for col in critical:
        if col in df.columns:
            n_miss = df[col].isna().sum()
            if n_miss > 0:
                issues.append(f"{col}: {n_miss} missing values")

    # 5. Check river_discharge placeholders
    if "river_discharge_m3s" in df.columns:
        n_zero = (df["river_discharge_m3s"] == 0.0).sum()
        if n_zero == len(df):
            warnings.append("river_discharge_m3s is all zeros (placeholder)")

    if "water_level_m" in df.columns:
        n_zero = (df["water_level_m"] == 0.0).sum()
        if n_zero == len(df):
            warnings.append("water_level_m is all zeros (placeholder)")

    # 6. Event-to-dataset join check
    if events:
        matched = 0
        unmatched = []
        for ev in events:
            found = False
            if ev.district_or_station_id in STATION_BY_ID:
                found = True
            else:
                for s in STATION_BY_ID.values():
                    if s["district"].lower() == ev.district_or_station_id.lower():
                        found = True
                        break
            if found:
                matched += 1
            else:
                unmatched.append(ev.district_or_station_id)
        if unmatched:
            warnings.append(f"events with unmatched districts: {unmatched}")

    # 7. Summary stats
    summary = {
        "total_rows": len(df),
        "stations": int(df["station_id"].nunique()),
        "date_range": f"{df['date'].min().date()} to {df['date'].max().date()}",
        "heuristic_positive_rate": round(float(df["flood_label"].mean()), 4),
        "issues": issues,
        "warnings": warnings,
    }

    if "v_label_24h" in df.columns:
        summary["verified_positive_rate_24h"] = round(float(df["v_label_24h"].mean()), 4)
        summary["verified_positive_rate_48h"] = round(float(df["v_label_48h"].mean()), 4)
        summary["verified_positive_rate_72h"] = round(float(df["v_label_72h"].mean()), 4)
        summary["verified_event_days"] = int(df["verified_event"].sum()) if "verified_event" in df.columns else 0

    return summary


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/processed/unified_daily.csv")
    ap.add_argument("--events", default=None)
    ap.add_argument("--out", default="docs/validation_report.json")
    args = ap.parse_args()

    report = validate_dataset(args.data, args.events)
    print(json.dumps(report, indent=2))
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nvalidation report → {args.out}")
    if report["issues"]:
        print(f"\n!!! {len(report['issues'])} ISSUES FOUND — fix before proceeding")


if __name__ == "__main__":
    main()
