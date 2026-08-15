# Ablation Table — v1 (heuristic-label pipeline validation)

**Labels: heuristic rainfall proxy (see README "Labeling").** These numbers
validate the end-to-end pipeline and the lead-time *shape* of results. They
are NOT final flood-prediction performance and must be re-run after the
INDOFFLOODS label join before any number enters the report.

## Test setup

Identical chronological test window for both models (last 15% of dates,
no shuffle): 4,086–4,095 station-days, 51 flood-label days (24h horizon).

| Model | Input | Task | Precision | Recall | F1 |
|---|---|---|---|---|---|
| Baseline stacking (KNN+SVM+RF+DT→LR) | same-day static features | same-day classification | 0.91 | 1.00 | 0.95 |
| Sequence GRU (7-day window + upstream lags) | past 7 days only | **24h lead forecast** | 0.83 | 0.69 | 0.75 |
| Sequence GRU | past 7 days only | **48h lead forecast** | 0.86 | 0.57 | 0.68 |
| Sequence GRU | past 7 days only | **72h lead forecast** | 0.87 | 0.47 | 0.61 |

## Reading this table (for the report)

1. The baseline's 0.95 F1 is **not comparable skill** — it sees same-day
   rainfall, and the current label is a deterministic rainfall threshold,
   so it is recovering a rule, not forecasting. Its purpose is to anchor
   the base-paper reproduction side of the ablation.
2. The sequence model never sees current or future rainfall. That it
   reaches F1 0.75 at 24h and 0.61 at 72h — with precision *rising* to
   0.87 at the longest horizon while recall decays — is the expected
   signature of a genuine lead-time forecaster: at longer horizons it
   stays conservative (few false alarms) but misses more events.
3. Lead-time accuracy (spec metric) will be computed against true event
   onsets after the INDOFLOODS join; the current proxy onset = first
   consecutive flood-label day.

## Brier scores (sequence model, raw probabilities)

| Horizon | Brier |
|---|---|
| 24h | 0.0041 |
| 48h | 0.0067 |
| 72h | 0.0103 |

Low absolute Brier reflects class imbalance (~1% positives) — report
alongside precision/recall, not instead of them. Calibration (isotonic/
Platt) is Phase 4 and not yet applied.
