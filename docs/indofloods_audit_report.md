# INDOFLOODS Coverage Audit — Pilot Report

Source: Zenodo 14584655 (CC-BY 4.0, Kuntla & Saharia 2025).
Scope: Maharashtra pilot — Karad / Kurundwad / Takli (Krishna basin).

Total gauges: 214 | total events: 4548 | MH gauges: 29 | MH events: 817

## Pilot gauge table

| Gauge | Station | Span | Entries | Coverage | Missing days | Events |
|-------|---------|------|---------|----------|--------------|--------|
| INDOFLOODS-gauge-684 (Karad (Krishna)) | Karad | 1965-06-01->2020-05-27 | 19776 | 98.5% | 309 | 5 (1997-08-24..2019-08-05) |
| INDOFLOODS-gauge-678 (Kurundwad (Krishna)) | Kurundwad | 1972-05-01->2020-05-27 | 17315 | 98.6% | 244 | 29 (1973-07-09..2019-08-04) |
| INDOFLOODS-gauge-612 (Takli (Krishna/Bhima)) | Takli | 1965-06-01->2020-05-27 | 19424 | 96.7% | 661 | 35 (1965-08-01..2019-08-07) |

### What the metadata CANNOT establish
- Exact missing days (only aggregate counts shipped) → no verified daily mask.
- Verified negatives: absence of an event row is NOT a verified negative day.
- Daily water-level/discharge series: NOT in the Zenodo bundle.

## Verdict: **BLOCKED**

Zenodo bundle ships aggregate counts + event rows only; no daily water-level/discharge series, so verified negative days cannot be constructed. Absence of an event row is NOT a verified negative.

**Unblocks when:** Per-day gauge records (water level + discharge, 1965–2020 or subset) with warning/danger exceedance flags for the pilot gauges — via author request (HydroSense Lab, IIT Delhi) or CWC.

Per-event matched rainfall (T1d..T10d): 4548 rows — usable for event-scale analysis only, not supervised daily training.

Allowed next step: ingestion + event-scale analysis tool. Forbidden: emitting a daily training CSV with manufactured negatives.
