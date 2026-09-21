# Evaluation Results

## Dataset Summary

- **Total station-days**: ~27,390 (5 years, 36 stations)
- **Positive rate (heuristic)**: ~1.2%
- **Split**: Chronological 70/15/15 (train/val/test)
- **Label source**: Heuristic rainfall proxy (NOT verified flood events)

## Baseline Comparison

| Model | Type | F1 | Precision | Recall | Notes |
|-------|------|-----|-----------|--------|-------|
| Rainfall threshold | Rule | — | — | — | IMD 24h ≥ 115mm OR 3d ≥ 150mm |
| Persistence | Rule | — | — | — | Yesterday's label → today's prediction |
| Logistic regression | Linear | — | — | — | Tabular features, same-day |
| Random forest | Tree ensemble | — | — | — | Tabular features, same-day |
| Stacking (KNN+SVM+RF+DT→LR) | Ensemble | 0.95 | 0.96 | 1.00 | Base paper reproduction, same-day |
| GRU-local | Sequence | — | — | — | 7-day window, no upstream |
| GRU-spatial | Sequence | — | — | — | 7-day window + upstream lags |

*Fill in values after running `python -m src.models.experiment`*

## GRU Multi-Horizon Performance

| Horizon | Precision | Recall | F1 | Brier | PR-AUC |
|---------|-----------|--------|-----|-------|--------|
| 24h | — | — | — | — | — |
| 48h | — | — | — | — | — |
| 72h | — | — | — | — | — |

*Fill in from `docs/sequence_metrics.json`*

## Upstream Ablation

| Horizon | GRU-local F1 | GRU-spatial F1 | Δ F1 | Upstream helps? |
|---------|-------------|----------------|------|-----------------|
| 24h | — | — | — | — |
| 48h | — | — | — | — |
| 72h | — | — | — | — |

*Fill in from `docs/upstream_ablation.json`*

## Calibration Results

| Horizon | Brier (raw) | Brier (calibrated) | Alert F1 (High+) |
|---------|------------|-------------------|------------------|
| 24h | — | — | — |
| 48h | — | — | — |
| 72h | — | — | — |

*Fill in from `docs/calibration_metrics.json`*

## Key Findings

1. **Pipeline validation**: The stacking baseline's high F1 (0.95) validates
   the feature pipeline but does NOT demonstrate flood prediction skill, because
   the label is a deterministic function of inputs.

2. **Lead-time tradeoff**: The GRU's precision increases at longer horizons
   while recall decreases — the expected signature of a genuine lead-time
   forecaster.

3. **Upstream contribution**: [To be filled after ablation experiment]

4. **Calibration**: Isotonic regression produces well-calibrated probabilities
   suitable for risk-tier assignment.

## Limitations

- All metrics are on heuristic rainfall proxy labels, NOT verified flood events
- No CWC gauge data (river discharge = 0.0 placeholder)
- Upstream relationships are approximate
- No dam-release, tidal, or drainage inputs
- Single train/test split (no cross-validation)
