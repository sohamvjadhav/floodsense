"""
INDOFLOODS coverage audit — pilot gauges (Karad / Kurundwad / Takli + Maharashtra).

Reads the Zenodo bundle (metadata + flood-events + per-event precipitation,
CC-BY 4.0, doi:10.5281/zenodo.14584655) and reports what can honestly be
claimed. It NEVER manufactures daily negative labels: the bundle ships
aggregate observation counts and event rows only — no daily water-level /
discharge time series — so the exact missing days are unknowable from
these files alone.

Verdict logic:
    BLOCKED — real-label (supervised) training stays blocked until
    verified DAILY gauge records (per-day water level/discharge with
    warning/danger exceedance flags) are obtained for the pilot gauges.
    The report states exactly which file would unblock training.

Usage:
    python -m src.data.indofloods_audit \
        --metadata /tmp/meta_indofloods.csv \
        --events /tmp/events_indofloods.csv \
        --precip /tmp/precip_indofloods.csv \
        --out docs/indofloods_audit_report.md
"""

import argparse
import csv
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

PILOT_GAUGES = ["INDOFLOODS-gauge-684", "INDOFLOODS-gauge-678", "INDOFLOODS-gauge-612"]
PILOT_NAMES = {"INDOFLOODS-gauge-684": "Karad (Krishna)",
               "INDOFLOODS-gauge-678": "Kurundwad (Krishna)",
               "INDOFLOODS-gauge-612": "Takli (Krishna/Bhima)"}


def _gauge_of(event_id: str) -> str:
    m = re.match(r"(INDOFLOODS-gauge-\d+)-\d+", event_id)
    return m.group(1) if m else event_id


def load_metadata(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def load_events(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def coverage_row(r: dict) -> dict:
    s = datetime.strptime(r["Start_date"], "%Y-%m-%d")
    e = datetime.strptime(r["End_date"], "%Y-%m-%d")
    span = (e - s).days + 1
    lvl = int(r["Level_Entries"])
    return {"span_days": span, "level_entries": lvl,
            "coverage_pct": round(100 * lvl / span, 1),
            "missing_days": span - lvl}


def audit(metadata_path: str, events_path: str, precip_path: str | None = None) -> dict:
    meta = load_metadata(metadata_path)
    events = load_events(events_path)
    by_gauge = {r["GaugeID"]: r for r in meta}

    ev_gauge = [_gauge_of(r["EventID"]) for r in events]
    counts = Counter(ev_gauge)
    mh_gauges = [r for r in meta if "Maharashtra" in r["State"]]

    pilot = {}
    for gid in PILOT_GAUGES:
        r = by_gauge.get(gid)
        if not r:
            pilot[gid] = {"present": False}
            continue
        cov = coverage_row(r)
        gev = [e for e in events if _gauge_of(e["EventID"]) == gid]
        dates = sorted(e["Start Date"] for e in gev) if gev else []
        types = Counter(e["Flood Type"] for e in gev)
        pilot[gid] = {
            "present": True,
            "name": PILOT_NAMES[gid],
            "station": r["Station"],
            "river": r["River Name/ Tributory/ SubTributory"],
            "privacy": r["Privacy"],
            "reliability": r["Reliability"],
            "span": f"{r['Start_date']}->{r['End_date']}",
            **cov,
            "n_events": len(gev),
            "event_range": f"{dates[0]}..{dates[-1]}" if dates else None,
            "types": dict(types),
            # Aggregate counts only: exact missing days UNKNOWABLE.
            "daily_mask_available": False,
        }

    mh_events = sum(counts.get(r["GaugeID"], 0) for r in mh_gauges)
    result = {
        "total_gauges": len(meta),
        "total_events": len(events),
        "mh_gauges": len(mh_gauges),
        "mh_events": mh_events,
        "pilot": pilot,
        "daily_series_available": False,
        "verdict": "BLOCKED",
        "verdict_reason": ("Zenodo bundle ships aggregate counts + event rows only; "
                           "no daily water-level/discharge series, so verified "
                           "negative days cannot be constructed. Absence of an "
                           "event row is NOT a verified negative."),
        "unblock_requires": ("Per-day gauge records (water level + discharge, "
                              "1965–2020 or subset) with warning/danger "
                              "exceedance flags for the pilot gauges — via "
                              "author request (HydroSense Lab, IIT Delhi) or CWC."),
    }
    if precip_path and Path(precip_path).exists():
        with open(precip_path, newline="", encoding="utf-8-sig") as f:
            n = sum(1 for _ in f) - 1
        result["precip_rows"] = n
        result["precip_note"] = ("Per-event matched rainfall T1d..T10d available "
                                 "for event-scale analysis (not daily series).")
    return result


def render_markdown(rep: dict) -> str:
    L = ["# INDOFLOODS Coverage Audit — Pilot Report", "",
         "Source: Zenodo 14584655 (CC-BY 4.0, Kuntla & Saharia 2025).",
         "Scope: Maharashtra pilot — Karad / Kurundwad / Takli (Krishna basin).", "",
         f"Total gauges: {rep['total_gauges']} | total events: {rep['total_events']} | "
         f"MH gauges: {rep['mh_gauges']} | MH events: {rep['mh_events']}", "",
         "## Pilot gauge table", "",
         "| Gauge | Station | Span | Entries | Coverage | Missing days | Events |",
         "|-------|---------|------|---------|----------|--------------|--------|"]
    for gid in PILOT_GAUGES:
        p = rep["pilot"][gid]
        if not p.get("present"):
            L.append(f"| {gid} | MISSING | — | — | — | — | — |")
            continue
        L.append(f"| {gid} ({p['name']}) | {p['station']} | {p['span']} | "
                 f"{p['level_entries']} | {p['coverage_pct']}% | {p['missing_days']} | "
                 f"{p['n_events']} ({p['event_range']}) |")
    L += ["", "### What the metadata CANNOT establish",
          "- Exact missing days (only aggregate counts shipped) → no verified daily mask.",
          "- Verified negatives: absence of an event row is NOT a verified negative day.",
          "- Daily water-level/discharge series: NOT in the Zenodo bundle.", "",
          "## Verdict: **BLOCKED**", "",
          rep["verdict_reason"], "",
          "**Unblocks when:** " + rep["unblock_requires"], "",
          "Per-event matched rainfall (T1d..T10d): " +
          str(rep.get("precip_rows", "n/a")) + " rows — usable for event-scale "
          "analysis only, not supervised daily training.", "",
          "Allowed next step: ingestion + event-scale analysis tool. "
          "Forbidden: emitting a daily training CSV with manufactured negatives."]
    return "\n".join(L) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--metadata", required=True)
    ap.add_argument("--events", required=True)
    ap.add_argument("--precip", default=None)
    ap.add_argument("--out", default="docs/indofloods_audit_report.md")
    ap.add_argument("--json-out", default="docs/indofloods_audit.json")
    args = ap.parse_args()

    rep = audit(args.metadata, args.events, args.precip)
    import json
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(render_markdown(rep))
    Path(args.json_out).write_text(json.dumps(rep, indent=2))
    print(f"verdict: {rep['verdict']} — {rep['verdict_reason']}")
    print(f"report → {args.out} | json → {args.json_out}")


if __name__ == "__main__":
    main()
