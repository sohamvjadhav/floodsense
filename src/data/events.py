"""
Event schema and registry for verified flood-event labels.

Each flood event record captures:
- Source and verification provenance
- Spatial mapping to station/district
- Temporal precision (onset, start, end)
- Evidence type and confidence

Usage:
    from src.data.events import FloodEvent, load_events
"""

import csv
import json
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path
from typing import Optional

EVENT_LOG_CSV = Path(__file__).resolve().parent.parent.parent / "docs" / "event_verification_log.csv"
EVENT_SCHEMA_VERSION = "1.0"


@dataclass
class FloodEvent:
    event_id: str
    source_name: str
    source_url_or_reference: str
    district_or_station_id: str
    basin: str
    event_start_date: str          # ISO date
    event_end_date: str            # ISO date
    event_onset_date: str          # ISO date — first observed impact
    location_precision: str        # "district" | "station" | "sub-district"
    evidence_type: str             # "gauge" | "satellite" | "media" | "official_record" | "manual_verification"
    verified_by: str               # person or system
    confidence: str                # "high" | "medium" | "low"
    notes: str = ""
    label_24h: int = 0             # 1 if onset within 24h of issue time
    label_48h: int = 0             # 1 if onset within 48h
    label_72h: int = 0             # 1 if onset within 72h


EVENT_FIELDS = [
    "event_id", "source_name", "source_url_or_reference",
    "district_or_station_id", "basin", "event_start_date", "event_end_date",
    "event_onset_date", "location_precision", "evidence_type",
    "verified_by", "confidence", "notes",
    "label_24h", "label_48h", "label_72h",
]


def load_events(csv_path: Optional[str] = None) -> list[FloodEvent]:
    """Load verified events from the verification log CSV."""
    path = Path(csv_path) if csv_path else EVENT_LOG_CSV
    if not path.exists():
        return []
    events = []
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            events.append(FloodEvent(**{k: row.get(k, "") for k in EVENT_FIELDS}))
    return events


def save_events(events: list[FloodEvent], csv_path: Optional[str] = None):
    """Save verified events to the verification log CSV."""
    path = Path(csv_path) if csv_path else EVENT_LOG_CSV
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=EVENT_FIELDS)
        writer.writeheader()
        for ev in events:
            writer.writerow(asdict(ev))
    print(f"saved {len(events)} events to {path}")


def events_to_dict(events: list[FloodEvent]) -> list[dict]:
    """Convert events to list of dicts for JSON serialization."""
    return [asdict(ev) for ev in events]
