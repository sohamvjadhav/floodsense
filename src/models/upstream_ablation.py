"""
Upstream propagation ablation: does upstream rainfall improve
warning lead time over local-only features?

This module runs the full ablation and produces analysis output.

Usage:
    python -m src.models.upstream_ablation --data data/processed/unified_daily.csv
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch

from .sequence_model import (FloodGRU, make_windows, train_split,
                             add_upstream_lags, HORIZONS, SEQ_FEATURES)
from .evaluate import compute_all_metrics


def analyze_upstream_contribution(df: pd.DataFrame) -> dict:
    """Analyze how much upstream features contribute per basin."""
    from ..data.stations import STATION_BY_ID

    df = add_upstream_lags(df)
    df[["up_rain_lag1", "up_rain_lag2"]] = df[["up_rain_lag1", "up_rain_lag2"]].fillna(0.0)

    analysis = {}
    for basin in df["basin"].unique():
        basin_stations = [s["station_id"] for s in STATION_BY_ID.values()
                          if s["basin"] == basin]
        basin_df = df[df["station_id"].isin(basin_stations)]

        # Correlation between upstream lag and flood label
        corr_lag1 = basin_df["up_rain_lag1"].corr(basin_df["flood_label"])
        corr_lag2 = basin_df["up_rain_lag2"].corr(basin_df["flood_label"])

        # Stations with upstream vs without
        has_upstream = [s["station_id"] for s in STATION_BY_ID.values()
                        if s["basin"] == basin and s["upstream_ids"]]
        no_upstream = [s["station_id"] for s in STATION_BY_ID.values()
                       if s["basin"] == basin and not s["upstream_ids"]]

        analysis[basin] = {
            "stations_total": len(basin_stations),
            "stations_with_upstream": len(has_upstream),
            "stations_without_upstream": len(no_upstream),
            "corr_upstream_lag1_flood": round(float(corr_lag1), 4) if not np.isnan(corr_lag1) else None,
            "corr_upstream_lag2_flood": round(float(corr_lag2), 4) if not np.isnan(corr_lag2) else None,
            "mean_upstream_lag1": round(float(basin_df["up_rain_lag1"].mean()), 2),
            "mean_upstream_lag2": round(float(basin_df["up_rain_lag2"].mean()), 2),
        }

    return analysis


def run_upstream_ablation(data_path: str, out_dir: str = "docs",
                          epochs: int = 15) -> dict:
    """Run the full upstream ablation experiment."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(data_path, parse_dates=["date"])

    print("=" * 60)
    print("Upstream Propagation Ablation")
    print("=" * 60)

    # 1. Analyze upstream contribution
    print("\n1. Analyzing upstream feature contribution per basin...")
    basin_analysis = analyze_upstream_contribution(df)

    for basin, info in basin_analysis.items():
        print(f"  {basin}: {info['stations_with_upstream']}/{info['stations_total']} "
              f"stations with upstream, corr(lag1, flood)={info['corr_upstream_lag1_flood']}")

    # 2. Train GRU-local (no upstream) — use_upstream=False zeroes lags
    # AFTER computation so the signal is really removed (identical
    # shapes/pipeline, no silent recompute). Same buffered folds as spatial.
    print("\n2. Training GRU-local (no upstream features)...")
    from .sequence_model import EMBARGO_DAYS
    X_seq_l, X_static_l, y_l, dates_l, sids_l, stats_l = make_windows(
        df, use_upstream=False)
    tr_l, va_l, te_l = train_split(X_seq_l, X_static_l, y_l, dates_l,
                                   embargo=EMBARGO_DAYS)

    torch.manual_seed(42)
    model_local = FloodGRU()
    _train_model(model_local, tr_l, va_l, epochs)

    model_local.eval()
    with torch.no_grad():
        p_local = model_local(torch.from_numpy(te_l[0]),
                              torch.from_numpy(te_l[1])).numpy()
    metrics_local = compute_all_metrics(te_l[2], p_local)

    # 3. Train GRU-spatial (with upstream) — identical folds.
    print("\n3. Training GRU-spatial (with upstream features)...")
    X_seq_s, X_static_s, y_s, dates_s, sids_s, stats_s = make_windows(
        df, use_upstream=True)
    tr_s, va_s, te_s = train_split(X_seq_s, X_static_s, y_s, dates_s,
                                   embargo=EMBARGO_DAYS)

    torch.manual_seed(42)
    model_spatial = FloodGRU()
    _train_model(model_spatial, tr_s, va_s, epochs)

    model_spatial.eval()
    with torch.no_grad():
        p_spatial = model_spatial(torch.from_numpy(te_s[0]),
                                  torch.from_numpy(te_s[1])).numpy()
    metrics_spatial = compute_all_metrics(te_s[2], p_spatial)

    # 4. Compare
    print("\n4. Ablation results:")
    ablation = {}
    for h_key in ["24h", "48h", "72h"]:
        local_m = metrics_local["horizons"][h_key]
        spatial_m = metrics_spatial["horizons"][h_key]
        improvement = {
            "f1": round(spatial_m["f1"] - local_m["f1"], 4),
            "recall": round(spatial_m["recall"] - local_m["recall"], 4),
            "precision": round(spatial_m["precision"] - local_m["precision"], 4),
        }
        ablation[h_key] = {
            "local": local_m,
            "spatial": spatial_m,
            "improvement": improvement,
            "upstream_helps": improvement["f1"] > 0,
        }
        print(f"  {h_key}: local F1={local_m['f1']:.4f} → spatial F1={spatial_m['f1']:.4f} "
              f"(Δ={improvement['f1']:+.4f})")

    # 5. Save results
    results = {
        "basin_analysis": basin_analysis,
        "ablation": ablation,
        "conclusion": _make_conclusion(ablation),
    }

    results_path = out / "upstream_ablation.json"
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2, default=str)

    # Save analysis report
    report_path = out / "upstream_ablation.md"
    with open(report_path, "w") as f:
        f.write("# Upstream Propagation Ablation\n\n")
        f.write("## Research Question\n\n")
        f.write("> Does upstream rainfall history improve verified flood-risk prediction\n")
        f.write("> over local rainfall-only baselines?\n\n")

        f.write("## Basin Analysis\n\n")
        f.write("| Basin | Stations | With Upstream | corr(lag1, flood) |\n")
        f.write("|-------|----------|---------------|-------------------|\n")
        for basin, info in basin_analysis.items():
            f.write(f"| {basin} | {info['stations_total']} | "
                    f"{info['stations_with_upstream']} | "
                    f"{info['corr_upstream_lag1_flood']} |\n")

        f.write("\n## Ablation Results\n\n")
        f.write("| Horizon | GRU-local F1 | GRU-spatial F1 | Δ F1 | Upstream helps? |\n")
        f.write("|---------|-------------|----------------|------|-----------------|\n")
        for h_key, abl in ablation.items():
            helps = "Yes" if abl["upstream_helps"] else "No"
            f.write(f"| {h_key} | {abl['local']['f1']:.4f} | {abl['spatial']['f1']:.4f} | "
                    f"{abl['improvement']['f1']:+.4f} | {helps} |\n")

        f.write(f"\n## Conclusion\n\n{results['conclusion']}\n")

    print(f"\nresults → {results_path}")
    print(f"report → {report_path}")
    return results


def _train_model(model, tr, va, epochs, bs=256, lr=1e-3):
    """Helper to train a GRU model."""
    pos_w = torch.tensor(np.maximum(1.0, (len(tr[2]) / (tr[2].sum(0) + 1))),
                         dtype=torch.float32)
    lossf = torch.nn.BCELoss(reduction="none")
    opt = torch.optim.Adam(model.parameters(), lr=lr)

    Xtr = torch.from_numpy(tr[0])
    Str = torch.from_numpy(tr[1])
    Ytr = torch.from_numpy(tr[2])

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


def _make_conclusion(ablation: dict) -> str:
    """Generate a conclusion based on ablation results."""
    helps_count = sum(1 for a in ablation.values() if a["upstream_helps"])
    total = len(ablation)

    if helps_count == total:
        return ("Upstream features consistently improve F1 across all horizons. "
                "This supports the hypothesis that upstream rainfall propagation "
                "provides useful lead-time information for flood-risk prediction.")
    elif helps_count > 0:
        return (f"Upstream features improve F1 in {helps_count}/{total} horizons. "
                "Mixed results suggest upstream information is partially helpful "
                "but may not be universally beneficial across all lead times.")
    else:
        return ("Upstream features did not improve F1 in this experiment. "
                "Possible reasons: approximate upstream relationships, "
                "insufficient propagation signal, or dominant local rainfall "
                "effects. This is still a valid research finding.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/processed/unified_daily.csv")
    ap.add_argument("--out", default="docs")
    ap.add_argument("--epochs", type=int, default=15)
    args = ap.parse_args()
    run_upstream_ablation(args.data, args.out, args.epochs)
