"""
Baseline: stacking classifier per the base paper
("Prediction of Flooding Due to Heavy Rainfall in India Using Machine
Learning Algorithms", IEEE 2022-23) — KNN + SVM + RF + DT base learners,
logistic-regression meta-learner, same-day static features.

This is NOT the final deliverable. It exists to populate the ablation
table so the sequence model's improvement is measured, not asserted.

Evaluation uses a strictly TIME-BASED split: train on the first 70% of
days, validate on the next 15%, test on the last 15%. No random shuffle
anywhere — a shuffled split would leak future days into training.

Usage:
    python -m src.models.baseline_stacking --data data/processed/unified_daily.csv
"""

import argparse
import json

import pandas as pd
from sklearn.ensemble import RandomForestClassifier, StackingClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, f1_score, precision_score, recall_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.tree import DecisionTreeClassifier

FEATURES = [
    "rainfall_mm", "rain_3d_mm", "rain_7d_mm", "precip_hours",
    "river_discharge_m3s", "elevation_m",
]


def time_split(df: pd.DataFrame):
    """Chronological split on unique dates: 70/15/15 train/val/test."""
    dates = sorted(df["date"].unique())
    n = len(dates)
    train_end, val_end = dates[int(n * 0.70)], dates[int(n * 0.85)]
    train = df[df["date"] <= train_end]
    val = df[(df["date"] > train_end) & (df["date"] <= val_end)]
    test = df[df["date"] > val_end]
    return train, val, test


def build_stacking() -> StackingClassifier:
    estimators = [
        ("knn", make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=7))),
        ("svm", make_pipeline(StandardScaler(),
                              CalibratedClassifierCV(SVC(kernel="rbf"), ensemble=False,
                                                     method="sigmoid"))),
        ("rf", RandomForestClassifier(n_estimators=300, class_weight="balanced",
                                      random_state=42, n_jobs=-1)),
        ("dt", DecisionTreeClassifier(class_weight="balanced", random_state=42)),
    ]
    return StackingClassifier(
        estimators=estimators,
        final_estimator=LogisticRegression(class_weight="balanced", max_iter=1000),
        cv=5, n_jobs=-1,
    )


def main(data_path: str, out_path: str = "docs/baseline_metrics.json"):
    df = pd.read_csv(data_path, parse_dates=["date"])
    train, val, test = time_split(df)

    print(f"split sizes  train={len(train)}  val={len(val)}  test={len(test)}")
    print(f"positive rate train={train['flood_label'].mean():.4f} "
          f"val={val['flood_label'].mean():.4f} test={test['flood_label'].mean():.4f}")

    Xtr, ytr = train[FEATURES], train["flood_label"]
    Xte, yte = test[FEATURES], test["flood_label"]

    clf = build_stacking()
    clf.fit(pd.concat([Xtr, val[FEATURES]]), pd.concat([ytr, val["flood_label"]]))  # refit incl. val
    pred = clf.predict(Xte)

    report = classification_report(yte, pred, output_dict=True, zero_division=0)
    print("\n=== BASELINE STACKING — held-out test ===")
    print(classification_report(yte, pred, zero_division=0))

    metrics = {
        "model": "stacking (KNN+SVM+RF+DT -> LR)",
        "features": FEATURES,
        "split": "time-based 70/15/15",
        "test_size": int(len(test)),
        "accuracy": report["accuracy"],
        "precision_1": precision_score(yte, pred, zero_division=0),
        "recall_1": recall_score(yte, pred, zero_division=0),
        "f1_1": f1_score(yte, pred, zero_division=0),
    }
    with open(out_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"metrics written to {out_path}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/processed/unified_daily.csv")
    ap.add_argument("--out", default="docs/baseline_metrics.json")
    args = ap.parse_args()
    main(args.data, args.out)
