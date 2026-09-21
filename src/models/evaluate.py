"""
Comprehensive evaluation: per-horizon metrics, calibration, alert-level,
and event-level evaluation.

Usage:
    from src.models.evaluate import evaluate_model, compute_all_metrics
"""

import numpy as np
import pandas as pd
from sklearn.metrics import (
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    average_precision_score,
    confusion_matrix,
    classification_report,
)


HORIZONS = [24, 48, 72]


def evaluate_horizon(y_true: np.ndarray, y_prob: np.ndarray,
                     threshold: float = 0.5, horizon_h: int = 24) -> dict:
    """Compute metrics for a single horizon."""
    y_pred = (y_prob >= threshold).astype(int)

    metrics = {
        "horizon_h": horizon_h,
        "threshold": threshold,
        "n_samples": len(y_true),
        "n_positive": int(y_true.sum()),
        "positive_rate": round(float(y_true.mean()), 4),
    }

    # Core classification metrics
    metrics["precision"] = round(float(precision_score(y_true, y_pred, zero_division=0)), 4)
    metrics["recall"] = round(float(recall_score(y_true, y_pred, zero_division=0)), 4)
    metrics["f1"] = round(float(f1_score(y_true, y_pred, zero_division=0)), 4)

    # Brier score (calibration quality)
    metrics["brier"] = round(float(brier_score_loss(y_true, y_prob)), 5)

    # PR-AUC (important for imbalanced classes)
    if y_true.sum() > 0:
        metrics["pr_auc"] = round(float(average_precision_score(y_true, y_prob)), 4)
    else:
        metrics["pr_auc"] = None

    # Confusion matrix
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    metrics["true_positives"] = int(tp)
    metrics["false_positives"] = int(fp)
    metrics["true_negatives"] = int(tn)
    metrics["false_negatives"] = int(fn)

    # Alert-level metrics (High+Severe = positive)
    # For alert evaluation, treat threshold-based predictions as alerts
    metrics["false_alarms"] = int(fp)
    metrics["missed_events"] = int(fn)

    return metrics


def evaluate_all_horizons(y_true: np.ndarray, y_prob: np.ndarray,
                          horizons: list[int] = None,
                          threshold: float = 0.5) -> dict:
    """Evaluate all horizons at once.

    y_true: (N, H) array of binary labels per horizon
    y_prob: (N, H) array of predicted probabilities per horizon
    """
    if horizons is None:
        horizons = HORIZONS

    results = {}
    for k, h in enumerate(horizons):
        results[f"{h}h"] = evaluate_horizon(y_true[:, k], y_prob[:, k],
                                              threshold=threshold, horizon_h=h)
    return results


def calibration_curve_data(y_true: np.ndarray, y_prob: np.ndarray,
                           n_bins: int = 10) -> dict:
    """Compute calibration data: predicted probability vs observed frequency."""
    bins = np.linspace(0, 1, n_bins + 1)
    bin_centers = []
    observed_freqs = []
    bin_counts = []

    for i in range(n_bins):
        mask = (y_prob >= bins[i]) & (y_prob < bins[i + 1])
        if mask.sum() > 0:
            bin_centers.append(round(float((bins[i] + bins[i + 1]) / 2), 3))
            observed_freqs.append(round(float(y_true[mask].mean()), 4))
            bin_counts.append(int(mask.sum()))

    return {
        "bin_centers": bin_centers,
        "observed_frequencies": observed_freqs,
        "bin_counts": bin_counts,
    }


def false_alarm_rate(y_true: np.ndarray, y_prob: np.ndarray,
                     threshold: float, period_days: int = 30) -> dict:
    """Compute false alarms per period (e.g., per month)."""
    y_pred = (y_prob >= threshold).astype(int)
    fp = ((y_pred == 1) & (y_true == 0)).sum()
    n_days = len(y_true)
    months = max(1, n_days / period_days)
    return {
        "false_alarms_per_month": round(float(fp / months), 2),
        "total_false_alarms": int(fp),
        "evaluation_months": round(months, 1),
    }


def compute_all_metrics(y_true: np.ndarray, y_prob: np.ndarray,
                        horizons: list[int] = None,
                        threshold: float = 0.5) -> dict:
    """Full evaluation suite: horizons + calibration + false alarm rate."""
    if horizons is None:
        horizons = HORIZONS

    metrics = {
        "horizons": evaluate_all_horizons(y_true, y_prob, horizons, threshold),
        "overall": {},
    }

    # Overall metrics (averaged across horizons)
    for k, h in enumerate(horizons):
        h_metrics = metrics["horizons"][f"{h}h"]
        for key in ["precision", "recall", "f1", "brier"]:
            if key not in metrics["overall"]:
                metrics["overall"][key] = {}
            metrics["overall"][key][f"{h}h"] = h_metrics[key]

    # Calibration data for each horizon
    for k, h in enumerate(horizons):
        metrics["horizons"][f"{h}h"]["calibration"] = calibration_curve_data(
            y_true[:, k], y_prob[:, k])

    return metrics


def format_metrics_table(metrics: dict) -> str:
    """Format metrics as a readable markdown table."""
    lines = ["| Horizon | Precision | Recall | F1 | Brier | PR-AUC |",
             "|---------|-----------|--------|-----|-------|--------|"]
    for h_key, h_metrics in metrics["horizons"].items():
        pr_auc = h_metrics.get("pr_auc", "N/A")
        if pr_auc is not None:
            pr_auc = f"{pr_auc:.4f}"
        lines.append(
            f"| {h_key} | {h_metrics['precision']:.3f} | {h_metrics['recall']:.3f} "
            f"| {h_metrics['f1']:.3f} | {h_metrics['brier']:.5f} | {pr_auc} |"
        )
    return "\n".join(lines)
