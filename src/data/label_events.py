"""
Label events: join verified flood-event labels to the station/day timeline.

Produces a new CSV with verified event labels alongside the heuristic proxy,
so both can be compared and the proxy can be replaced.

Usage:
    python -m src.data.label_events
"""

import argparse
from datetime import timedelta
from pathlib import Path

import pandas as pd

from .events import load_events
from .stations import STATION_BY_ID


def compute_horizon_labels(onset_date: str, issue_dates: pd.Series) -> dict:
    """For each issue date, compute whether onset is within 24/48/72h."""
    onset = pd.Timestamp(onset_date)
    diffs = (onset - issue_dates).dt.total_seconds() / 3600
    return {
        "label_24h": ((diffs > 0) & (diffs <= 24)).astype(int),
        "label_48h": ((diffs > 0) & (diffs <= 48)).astype(int),
        "label_72h": ((diffs > 0) & (diffs <= 72)).astype(int),
    }


def label_dataset(csv_path: str, events_csv: str = None, out_path: str = None):
    """Join verified event labels to the unified dataset.

    Adds columns: verified_event, v_label_24h, v_label_48h, v_label_72h
    alongside the existing heuristic flood_label.
    """
    df = pd.read_csv(csv_path, parse_dates=["date"])
    events = load_events(events_csv)

    if not events:
        print("no verified events found — adding empty verified columns")
        df["verified_event"] = 0
        df["v_label_24h"] = 0
        df["v_label_48h"] = 0
        df["v_label_72h"] = 0
        df.to_csv(out_path or csv_path.replace(".csv", "_labeled.csv"), index=False)
        return df

    # Initialize verified columns
    df["verified_event"] = 0
    df["v_label_24h"] = 0
    df["v_label_48h"] = 0
    df["v_label_72h"] = 0

    for ev in events:
        # Map event to station(s)
        target_stations = []
        if ev.district_or_station_id in STATION_BY_ID:
            target_stations = [ev.district_or_station_id]
        else:
            # Try matching by district name
            for sid, s in STATION_BY_ID.items():
                if s["district"].lower() == ev.district_or_station_id.lower():
                    target_stations.append(sid)
                    break

        if not target_stations:
            print(f"  WARNING: event {ev.event_id} — unknown station/district "
                  f"'{ev.district_or_station_id}', skipping")
            continue

        # Mark the event window
        start = pd.Timestamp(ev.event_start_date)
        end = pd.Timestamp(ev.event_end_date)
        onset = pd.Timestamp(ev.event_onset_date)

        for sid in target_stations:
            mask = (df["station_id"] == sid) & (df["date"] >= start) & (df["date"] <= end)
            df.loc[mask, "verified_event"] = 1

            # Compute horizon labels for each day in the window
            station_dates = df.loc[df["station_id"] == sid, "date"]
            for idx in df[mask].index:
                issue_date = df.loc[idx, "date"]
                hours_to_onset = (onset - issue_date).total_seconds() / 3600
                if 0 < hours_to_onset <= 24:
                    df.loc[idx, "v_label_24h"] = 1
                if 0 < hours_to_onset <= 48:
                    df.loc[idx, "v_label_48h"] = 1
                if 0 < hours_to_onset <= 72:
                    df.loc[idx, "v_label_72h"] = 1

        print(f"  event {ev.event_id}: {ev.district_or_station_id} "
              f"{ev.event_start_date} → {ev.event_end_date} "
              f"(onset {ev.event_onset_date})")

    out = out_path or csv_path.replace(".csv", "_labeled.csv")
    df.to_csv(out, index=False)
    n_verified = int(df["verified_event"].sum())
    print(f"\nwrote {out}: {len(df)} rows, {n_verified} verified-event days")
    return df


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/processed/unified_daily.csv")
    ap.add_argument("--events", default=None, help="events CSV path")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    label_dataset(args.data, args.events, args.out)
