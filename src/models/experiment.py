"""
Unified experiment runner: trains all models, runs ablation, generates
comparison tables and metrics.

Usage:
    python -m src.models.experiment --data data/processed/unified_daily.csv
"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import torch

from .splits import time_split, time_split_with_buffer, get_split_dates
from .baselines import (rainfall_threshold_baseline, persistence_baseline,
                        logistic_regression_baseline, random_forest_baseline,
                        FEATURES_TABULAR)
from .evaluate import compute_all_metrics, format_metrics_table
from .sequence_model import (FloodGRU, make_windows, train_split as seq_train_split,
                             HORIZONS, SEQ_FEATURES, STATIC_FEATURES)


def train_gru_model(X_seq, X_static, y, dates, epochs=15, bs=256, lr=1e-3):
    """Train the GRU model and return trained model + metrics per epoch.

    dates must be the real window end-dates (chronological buffered
    split) — never dummy zeros (which silently destroyed chronology).
    """
    from .sequence_model import EMBARGO_DAYS
    tr, va, te = seq_train_split(X_seq, X_static, y, dates, embargo=EMBARGO_DAYS)

    torch.manual_seed(42)
    model = FloodGRU()
    pos_w = torch.tensor(np.maximum(1.0, (len(tr[2]) / (tr[2].sum(0) + 1))),
                         dtype=torch.float32)
    lossf = torch.nn.BCELoss(reduction="none")
    opt = torch.optim.Adam(model.parameters(), lr=lr)

    Xtr = torch.from_numpy(tr[0])
    Str = torch.from_numpy(tr[1])
    Ytr = torch.from_numpy(tr[2])

    history = []
    for ep in range(epochs):
        model.train()
        perm = torch.randperm(len(Xtr))
        tot = 0.0
        for i in range(0, len(Xtr), bs):
            idx = perm[i:i + bs]
            opt.zero_grad()
            p = model(Xtr[idx], Str[idx])
            loss = (lossf(p, Ytr[idx]) * pos_w).mean()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            tot += loss.item() * len(idx)
        history.append({"epoch": ep + 1, "train_loss": tot / len(Xtr)})

    return model, history


def run_experiment(data_path: str, out_dir: str = "docs"):
    """Run the full experiment suite."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(data_path, parse_dates=["date"])
    split_info = get_split_dates(df)

    print("=" * 60)
    print("FloodSense Experiment Suite")
    print("=" * 60)
    print(f"Dataset: {len(df)} rows, {df['station_id'].nunique()} stations")
    print(f"Date range: {df['date'].min().date()} to {df['date'].max().date()}")
    print(f"Split: {split_info}")
    print()

    results = {
        "experiment_id": f"floodsense_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
        "data_path": data_path,
        "split_info": split_info,
        "baselines": {},
        "gru_variants": {},
        "ablation": {},
    }

    # ── Baselines ──
    print("─" * 40)
    print("Running baselines...")
    print("─" * 40)

    train, val, test = time_split(df)
    results["baselines"]["rainfall_threshold"] = rainfall_threshold_baseline(df)
    results["baselines"]["persistence"] = persistence_baseline(df)
    results["baselines"]["logistic_regression"] = logistic_regression_baseline(train, val, test)
    results["baselines"]["random_forest"] = random_forest_baseline(train, val, test)

    for name, metrics in results["baselines"].items():
        print(f"  {name}: F1={metrics.get('f1', 'N/A')}")

    # ── GRU variants (ablation) ──
    print()
    print("─" * 40)
    print("Running GRU ablation...")
    print("─" * 40)

    # GRU without upstream (local only) — zeroed AFTER computation via
    # use_upstream=False so the ablation is real; identical buffered folds.
    print("\nTraining GRU-local (no upstream features)...")
    X_seq_l, X_static_l, y_l, dates_l, sids_l, stats_l = make_windows(
        df, use_upstream=False)
    model_local, hist_local = train_gru_model(X_seq_l, X_static_l, y_l, dates_l)
    tr_l, va_l, te_l = seq_train_split(X_seq_l, X_static_l, y_l, dates_l)

    model_local.eval()
    with torch.no_grad():
        p_local = model_local(torch.from_numpy(te_l[0]),
                              torch.from_numpy(te_l[1])).numpy()
    metrics_local = compute_all_metrics(te_l[2], p_local)
    results["gru_variants"]["gru_local"] = metrics_local
    print(f"  GRU-local 24h F1: {metrics_local['horizons']['24h']['f1']}")

    # GRU with upstream (full model) — identical folds.
    print("\nTraining GRU-spatial (with upstream features)...")
    X_seq_s, X_static_s, y_s, dates_s, sids_s, stats_s = make_windows(df)
    model_spatial, hist_spatial = train_gru_model(X_seq_s, X_static_s, y_s, dates_s)
    tr_s, va_s, te_s = seq_train_split(X_seq_s, X_static_s, y_s, dates_s)

    model_spatial.eval()
    with torch.no_grad():
        p_spatial = model_spatial(torch.from_numpy(te_s[0]),
                                  torch.from_numpy(te_s[1])).numpy()
    metrics_spatial = compute_all_metrics(te_s[2], p_spatial)
    results["gru_variants"]["gru_spatial"] = metrics_spatial
    print(f"  GRU-spatial 24h F1: {metrics_spatial['horizons']['24h']['f1']}")

    # ── Ablation comparison ──
    print()
    print("─" * 40)
    print("Ablation summary")
    print("─" * 40)

    for h in ["24h", "48h", "72h"]:
        local_f1 = metrics_local["horizons"][h]["f1"]
        spatial_f1 = metrics_spatial["horizons"][h]["f1"]
        improvement = spatial_f1 - local_f1
        results["ablation"][h] = {
            "gru_local_f1": local_f1,
            "gru_spatial_f1": spatial_f1,
            "upstream_improvement": round(improvement, 4),
            "upstream_helps": improvement > 0,
        }
        print(f"  {h}: local={local_f1:.4f} spatial={spatial_f1:.4f} "
              f"Δ={improvement:+.4f} {'✓' if improvement > 0 else '✗'}")

    # ── Save results ──
    results_path = out / "experiment_results.json"
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nresults → {results_path}")

    # Save comparison table
    table_path = out / "experiment_comparison.md"
    with open(table_path, "w") as f:
        f.write("# Experiment Comparison\n\n")
        f.write(f"**Date**: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n\n")
        f.write(f"**Dataset**: {len(df)} rows, {df['station_id'].nunique()} stations\n\n")

        f.write("## Baselines\n\n")
        f.write("| Model | F1 | Precision | Recall |\n")
        f.write("|-------|-----|-----------|--------|\n")
        for name, m in results["baselines"].items():
            f.write(f"| {name} | {m.get('f1', 'N/A')} | {m.get('precision', 'N/A')} | {m.get('recall', 'N/A')} |\n")

        f.write("\n## GRU Ablation\n\n")
        f.write("| Horizon | GRU-local F1 | GRU-spatial F1 | Upstream Δ |\n")
        f.write("|---------|-------------|----------------|------------|\n")
        for h, abl in results["ablation"].items():
            f.write(f"| {h} | {abl['gru_local_f1']:.4f} | {abl['gru_spatial_f1']:.4f} | "
                    f"{abl['upstream_improvement']:+.4f} |\n")

    print(f"comparison → {table_path}")
    return results


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/processed/unified_daily.csv")
    ap.add_argument("--out", default="docs")
    args = ap.parse_args()
    run_experiment(args.data, args.out)
