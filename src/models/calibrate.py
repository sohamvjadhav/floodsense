"""
Phase 4: isotonic calibration of the trained GRU's output probabilities.

Calibration is fit on the VALIDATION window only, evaluated on the same
held-out TEST window as every other metric — the calibration never sees
test data. Thresholds for risk tiers are chosen on validation as the
quantiles that map to Low/Medium/High/Severe, then applied unchanged.

Usage:
    python -m src.models.calibrate
"""

import json

import numpy as np
import pandas as pd
import torch
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import brier_score_loss, f1_score

from .sequence_model import (HORIZONS, FloodGRU, make_windows, train_split,
                             SEQ_FEATURES, STATIC_FEATURES)

TIERS = ["Low", "Medium", "High", "Severe"]


def main(data_path="data/processed/unified_daily.csv",
         ckpt="data/processed/flood_gru_v1.pt",
         out="docs/calibration_metrics.json"):
    df = pd.read_csv(data_path, parse_dates=["date"])
    X_seq, X_static, y, dates, sids = make_windows(df)
    tr, va, te = train_split(X_seq, X_static, y, dates)

    model = FloodGRU()
    model.load_state_dict(torch.load(ckpt, weights_only=True))
    model.eval()
    with torch.no_grad():
        p_va = model(torch.from_numpy(va[0]), torch.from_numpy(va[1])).numpy()
        p_te = model(torch.from_numpy(te[0]), torch.from_numpy(te[1])).numpy()

    results = {}
    for k, h in enumerate(HORIZONS):
        iso = IsotonicRegression(out_of_bounds="clip")
        iso.fit(p_va[:, k], va[2][:, k])           # fit on validation only
        p_cal = iso.predict(p_te[:, k])

        brier_raw = brier_score_loss(te[2][:, k], p_te[:, k])
        brier_cal = brier_score_loss(te[2][:, k], p_cal)

        # tier thresholds from validation quantiles (fixed before test)
        q = np.quantile(iso.predict(p_va[:, k]), [0.90, 0.97, 0.995])
        tier = np.digitize(p_cal, q)               # 0..3 → Low..Severe
        # "alert-worthy" = High or Severe; evaluate as classifier at that cut
        alert = tier >= 2
        f1_alert = f1_score(te[2][:, k], alert.astype(int), zero_division=0)

        results[f"{24*h}h"] = {
            "brier_raw": round(brier_raw, 5),
            "brier_calibrated": round(brier_cal, 5),
            "tier_thresholds": [round(float(x), 4) for x in q],
            "alert_f1_High+Severe": round(f1_alert, 4),
            "test_tier_counts": {t: int((tier == i).sum())
                                 for i, t in enumerate(TIERS)},
        }
        print(f"{24*h}h: brier {brier_raw:.4f} -> {brier_cal:.4f} | "
              f"alert F1 {f1_alert:.3f} | thresholds {np.round(q,3).tolist()}")

    with open(out, "w") as f:
        json.dump(results, f, indent=2)
    print("calibration metrics →", out)


if __name__ == "__main__":
    main()
