# FloodSense — ML-Based Flood Early Warning System for Maharashtra

Predicts district-level flood risk 24–72 hours in advance over the
Godavari, Krishna, and Konkan basins, serving risk through a web dashboard
and WhatsApp alerts.

**Stack:** Python · PyTorch · FastAPI · SQLAlchemy · APScheduler · React 19 ·
Vite · Tailwind v4 · Leaflet · Recharts · Twilio WhatsApp · Open-Meteo.
Single-service architecture: the FastAPI app serves the public API *and*
runs GRU inference in-process — no internal microservice hop.

## Differentiation from base paper

We reframe flood prediction as a **lead-time risk forecast** (probability
curve over the next 24/48/72h from a 7–14 day sequence window) and add
**upstream-to-downstream spatial propagation** via lagged
neighbor-station features — neither representable in a static-feature
stacking setup.

## Repository layout

```
src/data/stations.py           # 15-station Maharashtra registry + upstream adjacency
src/data/build_dataset.py      # Open-Meteo archive pull → unified daily schema
src/models/baseline_stacking.py# base-paper baseline (ablation reference)
src/models/sequence_model.py   # GRU sequence model, multi-horizon 24/48/72h
src/models/calibrate.py        # isotonic calibration + risk-tier thresholds
api/                           # FastAPI service: endpoints, live job, WhatsApp alerts
frontend/                      # React + Vite + Tailwind + Leaflet dashboard
data/processed/                # model artifacts (committed) + CSV (regenerated)
docs/                          # metrics JSON, report drafts, ablation
```

## Status

- [x] Phase 1 — unified schema, station registry, adjacency table, 5yr dataset (27,390 station-days)
- [x] Phase 2 — baseline stacking classifier evaluated on time-based split
- [x] Phase 3 — GRU sequence model, multi-horizon 24/48/72h, upstream-lag features (see `docs/ablation.md`)
- [x] Phase 4 — isotonic calibration + Low/Medium/High/Severe risk tiers (`docs/calibration_metrics.json`)
- [x] Phase 5 — FastAPI backend: risk/map/detail/subscribe/history endpoints + live scheduled job
- [x] Phase 6 — React/Leaflet dashboard: map, district detail, subscribe form
- [x] Phase 7 — Twilio WhatsApp alerts (REST; credential-gated with logged fallback)
- [x] Phase 8 — APScheduler live cycle: Open-Meteo → inference → risk state → alerts (`POST /api/cron/run` demo hook)
- [ ] Phase 9 — report draft (gap, dataset, methodology, ablation, limitations)
- [ ] Phase 10 — deploy: Render (`render.yaml`), Cloudflare Pages (`frontend/`)

## Run the system

```bash
# backend — API + inference on port 8000 (Swagger docs at /docs)
.venv/bin/uvicorn api.main:app --port 8000

# force a live refresh + alert check (also the viva demo hook)
curl -X POST localhost:8000/api/cron/run

# frontend
cd frontend && npm install
VITE_API_URL=http://localhost:8000 npm run dev          # dev server
VITE_API_URL=http://localhost:8000 npm run build        # production build
```

| Endpoint | Purpose |
|---|---|
| `GET /api/risk/map` | all districts: tier, color, 24/48/72h probabilities |
| `GET /api/risk/{district}` | probability curve, rainfall + forecast outlook, risk history |
| `POST /api/alerts/subscribe` | `{phone, district}` → WhatsApp subscription (Indian E.164 validated) |
| `GET /api/stations/{id}/history` | recent readings for detail charts |
| `POST /api/cron/run` | run one live cycle now (fetch → infer → alert check) |

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
.venv/bin/python -m src.models.sequence_model --epochs 12
```

## Unified schema

```
station_id, district, state, lat, lon, date, rainfall_mm, rain_3d_mm,
rain_7d_mm, precip_hours, river_discharge_m3s, water_level_m,
elevation_m, basin, upstream_station_ids, flood_label, data_confidence
```

| Field | Description |
|-------|-------------|
| `station_id` | Unique station code (e.g. `MH_NAS`) |
| `district` | District name |
| `state` | Always `Maharashtra` |
| `lat, lon` | District headquarters coordinates (gridded rainfall proxy) |
| `date` | Date |
| `rainfall_mm` | Daily precipitation from Open-Meteo archive |
| `rain_3d_mm` | 3-day rolling sum of rainfall |
| `rain_7d_mm` | 7-day rolling sum of rainfall |
| `precip_hours` | Hours with rain > 0.1mm |
| `river_discharge_m3s` | Placeholder (0.0) — join CWC gauge data for real values |
| `water_level_m` | Placeholder (0.0) — join CWC gauge data for real values |
| `elevation_m` | Station elevation |
| `basin` | Godavari / Krishna / Konkan |
| `upstream_station_ids` | Comma-separated upstream neighbors (approx.) |
| `flood_label` | Heuristic rainfall proxy (see Labeling section) |
| `data_confidence` | `measured` or `interpolated` — never silent |

### `data_confidence` values

- `measured` — raw API rainfall
- `interpolated` — gap-filled day via within-station time interpolation

**Important**: interpolation is never silent; the flag keeps it explicit.

### `river_discharge_m3s`, `water_level_m`

These are **zero placeholders**: the Open-Meteo archive API returns no
discharge over India. Join CWC gauge data before quoting any model metric
that uses them.

### `upstream_station_ids`

An **approximation** from elevation + river geography, not an official
CWC catchment map — documented limitation.

## Labeling — read before quoting any number

The current `flood_label` is a **heuristic rainfall proxy**
(24h ≥ 115mm IMD "extremely heavy" OR 3-day ≥ 150mm), not observed flood
events. Because the label is a deterministic function of model inputs,
the baseline's F1 = 0.95 **validates the pipeline only** — it is NOT
flood-prediction performance and must not appear in the report as such.
Real labels come from INDOFLOODS (https://hydrosense.iitd.ac.in/resources/);
every metric gets re-run after that join.

## Data source priority

1. **INDOFLOODS** (IIT Delhi HydroSense) — primary flood-event labels *(pending manual download)*
2. data.gov.in CWC rainfall — historical baselines, gap-filling
3. IMD Mausam/NDSAP — departure-from-normal feature
4. Kaggle Flood Risk India — supplementary only, labeled as such
5. Open-Meteo — training history + live demo feed (used now)

## Evaluation policy

Time-based splits ONLY (70/15/15 by date, no shuffle). Lead-time accuracy
metric is mandatory for any "lead time" claim. Every report claim must
trace to a computed metric in the ablation table.

---

## Ablation study (docs/ablation.md)

See the ablation analysis comparing:
- Baseline stacking (KNN+SVM+RF+DT → LR) with same-day features
- GRU sequence model with 7-day history + upstream lag features
- Impact of upstream rain lags (1d, 2d) on multi-horizon risk

## Calibration (docs/calibration_metrics.json)

Isotonic calibration on validation set. Risk-tier thresholds are the
90th/97th/99.5th percentiles of calibrated validation probabilities
(quantile-based, so tiers stay meaningful under class imbalance):
- **Low**: below 90th percentile
- **Medium**: 90th–97th
- **High**: 97th–99.5th
- **Severe**: above 99.5th

## Train the baseline stacking

```bash
.venv/bin/python -m src.models.baseline_stacking
```

Writes `docs/baseline_metrics.json` with F1, precision, recall.

## Citation

If you use this code, please cite:

```
@misc{floodsense2026,
  author    = {Soham Jadhav},
  title     = {FloodSense: ML-Based Flood Early Warning System for Maharashtra},
  year      = {2026},
  howpublished = \url{https://github.com/sohamvjadhav/floodsense}
}
```