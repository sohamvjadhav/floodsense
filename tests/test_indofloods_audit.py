"""
Batch-1: INDOFLOODS audit refuses to manufacture supervised labels.

Usage:
    python -m pytest tests/test_indofloods_audit.py -v
"""

import csv

import pytest

from src.data.indofloods_audit import audit, _gauge_of


@pytest.fixture
def bundle(tmp_path):
    meta = tmp_path / "meta.csv"
    events = tmp_path / "events.csv"
    with open(meta, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["GaugeID", "Warning Level", "Danger Level", "Station",
                    "Latitude", "Longitude", "River Name/ Tributory/ SubTributory",
                    "Basin", "State", "Start_date", "End_date", "Level_Entries",
                    "Streamflow_Entries", "Privacy", "Source Catchment Area",
                    "Catchment Area", "Area variation (%)", "Reliability"])
        w.writerow(["INDOFLOODS-gauge-684", 1, 2, "Karad", 17.29, 74.19,
                    "Krishna", "Krishna", "Maharashtra", "1965-06-01",
                    "2020-05-27", 19776, 19544, "Open", 5462, 5462, 0, "Safe"])
        w.writerow(["INDOFLOODS-gauge-678", 1, 2, "Kurundwad", 16.68, 74.60,
                    "Krishna", "Krishna", "Maharashtra", "1972-05-01",
                    "2020-05-27", 17315, 17105, "Open", 15190, 15190, 0, "Safe"])
    with open(events, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["EventID", "Start Date", "End Date", "Flood Type"])
        w.writerow(["INDOFLOODS-gauge-684-1", "2019-08-05", "2019-08-07", "Flood"])
        w.writerow(["INDOFLOODS-gauge-678-1", "2019-08-04", "2019-08-06", "Severe Flood"])
    return str(meta), str(events)


def test_gauge_id_parsing():
    assert _gauge_of("INDOFLOODS-gauge-684-12") == "INDOFLOODS-gauge-684"


def test_verdict_blocked_without_daily_series(bundle):
    meta, events = bundle
    rep = audit(meta, events)
    assert rep["verdict"] == "BLOCKED"
    assert rep["daily_series_available"] is False
    assert "unblock_requires" in rep


def test_no_training_csv_emitted(bundle, tmp_path):
    """The audit must not produce daily labels — absence is not negative."""
    meta, events = bundle
    rep = audit(meta, events)
    assert "y_train" not in rep
    assert "negatives" not in rep
    # pilot entries carry no daily mask
    for gid in ("INDOFLOODS-gauge-684", "INDOFLOODS-gauge-678"):
        assert rep["pilot"][gid]["daily_mask_available"] is False


def test_pilot_coverage_counts(bundle):
    meta, events = bundle
    rep = audit(meta, events)
    karad = rep["pilot"]["INDOFLOODS-gauge-684"]
    assert karad["n_events"] == 1
    assert karad["coverage_pct"] > 95
