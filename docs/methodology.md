# Methodology

## System Overview

FloodSense is an end-to-end flood-risk decision-support system comprising:

1. **Data pipeline** — Open-Meteo archive API → unified daily schema with
   derived features and upstream-lag spatial propagation signals
2. **Sequence model** — GRU neural network over a 7-day station window,
   predicting calibrated 24/48/72-hour risk probabilities
3. **Calibration** — Isotonic regression mapping raw GRU outputs to
   well-calibrated probabilities, with quantile-based risk tiers
4. **API service** — FastAPI serving risk data, replay, scenarios, and alerts
5. **Dashboard** — React/Leaflet interactive map and district detail views
6. **Alerts** — WhatsApp delivery via Twilio REST API

## Feature Design

### Sequential features (per timestep, per station)

| Feature | Description |
|---------|-------------|
| `rainfall_mm` | Daily precipitation from Open-Meteo archive |
| `rain_3d_mm` | 3-day rolling sum of rainfall |
| `rain_7d_mm` | 7-day rolling sum of rainfall |
| `precip_hours` | Hours with precipitation > 0.1mm |
| `up_rain_lag1` | Mean rainfall at upstream stations, shifted 1 day |
| `up_rain_lag2` | Mean rainfall at upstream stations, shifted 2 days |

### Static features

| Feature | Description |
|---------|-------------|
| `elevation_m` | Station elevation (district HQ proxy) |
| `lat` | Latitude |
| `lon` | Longitude |

### Upstream propagation

Upstream station relationships are defined in `src/data/stations.py` based
on approximate river-network adjacency using elevation and river geography.
For each station, upstream neighbors are identified and their lagged
rainfall (1-day and 2-day shifts) is averaged to create spatial propagation
features.

This is an **approximation**, not an official CWC catchment map.

## Model Architecture

### FloodGRU

- **Temporal branch**: Single-layer GRU (hidden_size=48) processing the
  7-day sequence of 6 features
- **Static branch**: Small feedforward network (3 → 16) encoding
  elevation, latitude, longitude
- **Head**: Linear(64 → 32) → ReLU → Dropout(0.2) → Linear(32 → 3)
  → Sigmoid
- **Output**: 3 sigmoid probabilities for 24h, 48h, 72h risk

### Key design property

The model NEVER sees current-day or future rainfall. At prediction time,
it uses only the 7-day history ending at the observation cutoff. This is
the lead-time contribution — the baseline classifier sees same-day rainfall.

## Training

- **Loss**: BCE with class-weight balancing (inverse frequency)
- **Optimizer**: Adam (lr=1e-3), gradient clipping at 1.0
- **Split**: Strictly chronological 70/15/15 (train/val/test by date)
- **Seed**: 42 (reproducibility)

## Calibration

Isotonic regression fit on the validation window only:

1. Raw GRU probabilities → isotonic mapping → calibrated probabilities
2. Risk-tier thresholds from validation quantiles (90th/97th/99.5th)
3. Tiers: Low (< 90th), Medium (90th–97th), High (97th–99.5th), Severe (> 99.5th)

## Evaluation

- Chronological train/validation/test splits (no shuffle)
- Horizon-specific metrics: F1, precision, recall, Brier score
- Alert-level evaluation: High+Severe tier as binary classifier
- Tier distribution analysis

## Limitations

- Labels are currently a rainfall-extreme proxy, not observed flood events
- Upstream relationships are approximate, not official CWC topology
- `river_discharge_m3s` and `water_level_m` are zero placeholders
- District HQ coordinates used as proxy points for gridded rainfall
- No dam-release, tidal, or drainage-condition inputs
