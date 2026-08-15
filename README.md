# FloodSense — ML-Based Flood Early Warning System for Maharashtra

Predicts district-level flood risk 24–72 hours in advance over the
Godavari, Krishna, and Konkan basins, serving risk through a web dashboard
and WhatsApp alerts. .

**Differentiation from base paper** (stacking classifier, KNN/SVM/RF/DT →
LR, static same-day features, ~97.9% accuracy in Andhra Pradesh): we
reframe flood prediction as a **lead-time risk forecast** (probability
curve over the next 24/48/72h from a 7–14 day sequence window) and add
**upstream-to-downstream spatial propagation** via lagged
neighbor-station features — neither representable in a static-feature
stacking setup.

## Repository layout

```
src/data/stations.py           # 15-station Maharashtra registry + upstream adjacency
src/data/build_dataset.py      # Open-Meteo archive pull → unified daily schema
src/models/baseline_stacking.py# base-paper baseline (ablation reference)
data/processed/                # unified_daily.csv (generated, not committed)
docs/                          # metrics JSON, report drafts
```

## Status

- [x] Phase 1 — unified schema, station registry, adjacency table, 5yr dataset (27,390 station-days)
- [x] Phase 2 — baseline stacking classifier evaluated on time-based split
- [x] Phase 3 — GRU sequence model, multi-horizon 24/48/72h, upstream-lag features (see `docs/ablation.md`)
- [ ] Phase 4 — probability calibration (isotonic/Platt) + risk tiers
- [ ] Phase 5 — Laravel backend + FastAPI inference microservice
- [ ] Phase 5 — Laravel backend + FastAPI inference microservice
- [ ] Phase 6 — React/Leaflet dashboard → Cloudflare Pages
- [ ] Phase 7 — Twilio WhatsApp alerts
- [ ] Phase 8 — scheduled live-data cron (Open-Meteo forecast feed)
- [ ] Phase 9 — report draft (gap, dataset, methodology, ablation, limitations)

## Train the sequence model

```bash
.venv/bin/python -m src.models.sequence_model --epochs 12
```

Writes `data/processed/flood_gru_v1.pt` (weights) and
`docs/sequence_metrics.json` (test metrics).

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m src.data.build_dataset --years 5   # ~1min, free API, no key
.venv/bin/python -m src.models.baseline_stacking
```

## Unified schema

`station_id, district, state, lat, lon, date, rainfall_mm, rain_3d_mm,
rain_7d_mm, precip_hours, river_discharge_m3s, water_level_m,
elevation_m, basin, upstream_station_ids, flood_label, data_confidence`

- `data_confidence` ∈ {measured, interpolated} — interpolation is never silent.
- `river_discharge_m3s`, `water_level_m` are **zero placeholders**: the
  Open-Meteo archive API returns no discharge over India. Join CWC gauge
  data before quoting any model metric that uses them.
- `upstream_station_ids` is an **approximation** from elevation + river
  geography, not an official catchment map — documented limitation.

## Labeling — read before quoting any number

The current `flood_label` is a **heuristic rainfall proxy**
(24h ≥ 115mm IMD "extremely heavy" OR 3-day ≥ 150mm), not observed flood
events. Because the label is a deterministic function of model inputs,
the baseline's F1 = 0.95 **validates the pipeline only** — it is NOT
flood-prediction performance and must not appear in the report as such.
Real labels come from INDOFLOODS (https://hydrosense.iitd.ac.in/resources/);
every metric gets re-run after that join.

## Data source priority

1. INDOFLOODS (IIT Delhi HydroSense) — primary flood-event labels *(pending manual download)*
2. data.gov.in CWC rainfall — historical baselines, gap-filling
3. IMD Mausam/NDSAP — departure-from-normal feature
4. Kaggle Flood Risk India — supplementary only, labeled as such
5. Open-Meteo — training history + live demo feed (used now)

## Evaluation policy

Time-based splits ONLY (70/15/15 by date, no shuffle). Lead-time accuracy
metric is mandatory for any "lead time" claim. Every report claim must
trace to a computed metric in the ablation table.
