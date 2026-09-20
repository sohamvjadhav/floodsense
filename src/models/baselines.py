"""
Additional baselines: rainfall threshold, persistence, logistic regression,
random forest.

These complement the existing stacking classifier to provide a meaningful
ablation comparison.

Usage:
    python -m src.models.baselines --data data/processed/unified_daily.csv
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, precision_score, recall_score, brier_score_loss

from .splits import time_split

FEATURES_TABULAR = [
    "rainfall_mm", "rain_3d_mm", "rain_7d_mm", "precip_hours",
    "river_discharge_m3s", "elevation_m",
]

HORIZONS = [24, 48, 72]


# ── 1. Rainfall threshold baseline ──────────────────────────────────────

def rainfall_threshold_baseline(df: pd.DataFrame) -> dict:
    """IMD-style rainfall threshold: 24h >= 115mm OR 3-day >= 150mm.

    This is the current heuristic label — the baseline "learns" nothing,
    it just applies the rule.
    """
    results = {}
    for h in HORIZONS:
        horizon_days = h // 24
        y_true = []
        y_pred = []
        for sid, g in df.groupby("station_id"):
            g = g.sort_values("date").reset_index(drop=True)
            for i in range(len(g)):
                # Threshold predicts same-day (not lead-time)
                r24 = g.iloc[i]["rainfall_mm"]
                r3 = g.iloc[i]["rain_3d_mm"]
                pred = 1 if (r24 >= 115 or r3 >= 150) else 0

                # True label: any flood within next horizon_days
                if i + horizon_days <= len(g):
                    true = int(g.iloc[i:i + horizon_days]["flood_label"].max())
                else:
                    true = 0
                y_true.append(true)
                y_pred.append(pred)

        y_true = np.array(y_true)
        y_pred = np.array(y_pred)
        results[f"{h}h"] = {
            "model": "rainfall_threshold",
            "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
            "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
            "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
            "n_samples": len(y_true),
            "n_positive": int(y_true.sum()),
        }
    return results


# ── 2. Persistence baseline ─────────────────────────────────────────────

def persistence_baseline(df: pd.DataFrame) -> dict:
    """Persistence: if yesterday was risky, predict today is risky."""
    results = {}
    for h in HORIZONS:
        horizon_days = h // 24
        y_true = []
        y_pred = []
        for sid, g in df.groupby("station_id"):
            g = g.sort_values("date").reset_index(drop=True)
            for i in range(1, len(g)):
                # Predict today's label based on yesterday's label
                pred = int(g.iloc[i - 1]["flood_label"])
                if i + horizon_days <= len(g):
                    true = int(g.iloc[i:i + horizon_days]["flood_label"].max())
                else:
                    true = 0
                y_true.append(true)
                y_pred.append(pred)

        y_true = np.array(y_true)
        y_pred = np.array(y_pred)
        results[f"{h}h"] = {
            "model": "persistence",
            "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
            "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
            "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
            "n_samples": len(y_true),
            "n_positive": int(y_true.sum()),
        }
    return results


# ── 3. Logistic regression baseline ─────────────────────────────────────

def logistic_regression_baseline(train: pd.DataFrame, val: pd.DataFrame,
                                  test: pd.DataFrame) -> dict:
    """Logistic regression on tabular features."""
    Xtr = pd.concat([train[FEATURES_TABULAR], val[FEATURES_TABULAR]])
    ytr = pd.concat([train["flood_label"], val["flood_label"]])
    Xte = test[FEATURES_TABULAR]
    yte = test["flood_label"]

    clf = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)
    clf.fit(Xtr, ytr)
    pred = clf.predict(Xte)
    prob = clf.predict_proba(Xte)[:, 1]

    return {
        "model": "logistic_regression",
        "precision": round(float(precision_score(yte, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(yte, pred, zero_division=0)), 4),
        "f1": round(float(f1_score(yte, pred, zero_division=0)), 4),
        "brier": round(float(brier_score_loss(yte, prob)), 5),
        "n_samples": len(yte),
        "n_positive": int(yte.sum()),
    }


# ── 4. Random Forest baseline ───────────────────────────────────────────

def random_forest_baseline(train: pd.DataFrame, val: pd.DataFrame,
                            test: pd.DataFrame) -> dict:
    """Random Forest on tabular features."""
    Xtr = pd.concat([train[FEATURES_TABULAR], val[FEATURES_TABULAR]])
    ytr = pd.concat([train["flood_label"], val["flood_label"]])
    Xte = test[FEATURES_TABULAR]
    yte = test["flood_label"]

    clf = RandomForestClassifier(
        n_estimators=300, class_weight="balanced",
        random_state=42, n_jobs=-1
    )
    clf.fit(Xtr, ytr)
    pred = clf.predict(Xte)
    prob = clf.predict_proba(Xte)[:, 1]

    return {
        "model": "random_forest",
        "precision": round(float(precision_score(yte, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(yte, pred, zero_division=0)), 4),
        "f1": round(float(f1_score(yte, pred, zero_division=0)), 4),
        "brier": round(float(brier_score_loss(yte, prob)), 5),
        "n_samples": len(yte),
        "n_positive": int(yte.sum()),
    }


def run_all_baselines(data_path: str, out_path: str = "docs/all_baseline_metrics.json"):
    """Run all baselines and save results."""
    df = pd.read_csv(data_path, parse_dates=["date"])
    train, val, test = time_split(df)

    print(f"split sizes: train={len(train)} val={len(val)} test={len(test)}")
    print(f"positive rate: train={train['flood_label'].mean():.4f} "
          f"val={val['flood_label'].mean():.4f} test={test['flood_label'].mean():.4f}")

    results = {}

    print("\n1. Rainfall threshold baseline...")
    results["rainfall_threshold"] = rainfall_threshold_baseline(df)

    print("2. Persistence baseline...")
    results["persistence"] = persistence_baseline(df)

    print("3. Logistic regression baseline...")
    results["logistic_regression"] = logistic_regression_baseline(train, val, test)

    print("4. Random forest baseline...")
    results["random_forest"] = random_forest_baseline(train, val, test)

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nall baselines → {out_path}")
    return results


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/processed/unified_daily.csv")
    ap.add_argument("--out", default="docs/all_baseline_metrics.json")
    args = ap.parse_args()
    run_all_baselines(args.data, args.out)
