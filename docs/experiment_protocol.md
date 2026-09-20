# Experiment Protocol

## 1. Data Splitting

All experiments use **strictly chronological** train/validation/test splits:

- **Train**: First 70% of unique dates
- **Validation**: Next 15% of unique dates
- **Test**: Last 15% of unique dates

No random shuffling. No future observations leak into training.

### Horizon buffer

When computing labels at horizons (24h, 48h, 72h), the last `max(horizon)`
days of each split are excluded from label computation to prevent
cross-boundary leakage.

## 2. Normalization

- Fit `StandardScaler` on **training data only**
- Transform validation and test using training statistics
- Store normalization stats in `data/processed/norm_stats.json` for
  inference reproducibility

## 3. Threshold Selection

- Classification thresholds selected on **validation data only**
- Risk-tier quantile thresholds computed on validation probabilities
- Final metrics reported on held-out test set

## 4. Baselines

| # | Model | Description |
|---|-------|-------------|
| 1 | Rainfall threshold | IMD 24h ≥ 115mm OR 3-day ≥ 150mm |
| 2 | Persistence | Current risk state continues |
| 3 | Logistic regression | Static rainfall + geographic features |
| 4 | Random Forest | Non-sequential tabular baseline |
| 5 | Stacking (KNN+SVM+RF+DT→LR) | Base paper reproduction |
| 6 | GRU-local | GRU with local rainfall only (no upstream) |
| 7 | GRU-spatial | GRU with local + upstream lag features |

## 5. Metrics

### Per-horizon metrics

- Precision, Recall, F1
- Brier score (calibration quality)
- PR-AUC (area under precision-recall curve)

### Alert-level metrics

- Alert F1 (High + Severe tier as positive)
- False alerts per district per month
- Missed-event rate

### Calibration metrics

- Pre-calibration Brier score
- Post-calibration Brier score
- Tier distribution (Low/Medium/High/Severe counts)

## 6. Ablation Design

Compare these model variants on the identical test window:

| Model | Local rainfall | Sequence history | Upstream lag |
|-------|---------------|-----------------|--------------|
| Baseline stacking | Yes | No | No |
| GRU-local | Yes | Yes | No |
| GRU-spatial | Yes | Yes | Yes |

Research question: Does upstream information improve warning lead time or
reduce missed events?

## 7. Reproducibility

Each experiment run records:

- Random seed
- Data version (date range, station count)
- Model configuration (hidden size, layers, window)
- Training hyperparameters (epochs, batch size, learning rate)
- Metrics (train/val/test)
- Timestamp

Results stored in `docs/` as JSON with these metadata fields.
