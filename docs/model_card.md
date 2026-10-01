# Model Card — FloodGRU v1

## Model Details

- **Model type**: GRU (Gated Recurrent Unit) neural network
- **Version**: v1
- **Developed by**: Soham Jadhav
- **Date**: 2026
- **License**: See repository LICENSE
- **Repository**: https://github.com/sohamvjadhav/floodsense

## Intended Use

- **Primary use**: District-level flood-risk decision support for Maharashtra
- **Primary user**: District disaster-management officers
- **NOT intended for**: Automated evacuation, life-safety decisions, or operational forecasting

## Architecture

```
Input (7-day window × 6 features) → GRU(hidden=48) → ─┐
Input (3 static features) → Feedforward(→16) ──────────┤
                                                        ↓
                                              Linear(64→32) → ReLU → Dropout(0.2)
                                                        ↓
                                              Linear(32→3) → Sigmoid
                                                        ↓
                                              [risk_24h, risk_48h, risk_72h]
```

### Sequential features (per timestep)
- `rainfall_mm` — Daily precipitation
- `rain_3d_mm` — 3-day rolling sum
- `rain_7d_mm` — 7-day rolling sum
- `precip_hours` — Hours with precipitation
- `up_rain_lag1` — Upstream rainfall, 1-day lag
- `up_rain_lag2` — Upstream rainfall, 2-day lag

### Static features
- `elevation_m` — Station elevation
- `lat` — Latitude
- `lon` — Longitude

## Training

- **Loss**: BCE with class-weight balancing
- **Optimizer**: Adam (lr=1e-3, gradient clipping 1.0)
- **Epochs**: 15
- **Batch size**: 256
- **Seed**: 42

## Evaluation

- **Split**: Chronological 70/15/15 (train/val/test)
- **No shuffle**: Time-series integrity preserved
- **Label**: Heuristic rainfall proxy (NOT verified flood events)

### Performance (heuristic labels)

| Metric | 24h | 48h | 72h |
|--------|-----|-----|-----|
| F1 | — | — | — |
| Precision | — | — | — |
| Recall | — | — | — |
| Brier | — | — | — |

*Fill in from training output*

## Calibration

- **Method**: Isotonic regression on validation set
- **Risk tiers**: Low (< 90th percentile), Medium (90th–97th), High (97th–99.5th), Severe (> 99.5th)

## Limitations

1. Labels are rainfall-extreme proxy, not observed flood events
2. No river discharge or water level inputs
3. Upstream relationships are approximate
4. District HQ coordinates used as proxy points
5. No dam-release or tidal condition inputs
6. Single architecture, no ensemble

## Ethical Considerations

- NOT an official warning system
- Alerts are prototype/simulated only
- Low risk does NOT mean "safe"
- Always follow official disaster-management instructions
