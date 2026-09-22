"""
FloodSense sequence model v1 — GRU over a 7-day station window,
multi-horizon (24/48/72h) risk outputs.

EXPERIMENTAL RAINFALL-RISK GUIDANCE — not a flood forecast, not
inundation, not an evacuation order. Labels are a heuristic rainfall
proxy until verified daily gauge records are joined (see
docs/indofloods_audit_report.md — real-label training is BLOCKED).

Input per timestep (per station):
    rainfall_mm, rain_3d_mm, rain_7d_mm, precip_hours,
    upstream rain lagged 1d, upstream rain lagged 2d (mean over upstreams)

Static branch: elevation_m, lat, lon (normalized) — small feedforward.

Outputs (sigmoid): risk_24h, risk_48h, risk_72h = P(flood-label day
within next 1 / 2 / 3 days). NOTE: with the current heuristic rainfall
label these are rainfall-risk scores; re-run after INDOFLOODS join.

The model NEVER sees current-day or future rainfall — unlike the
baseline, which classifies same-day. That is the lead-time contribution.

Time-based split with horizon buffer (see src/models/splits.py), same
70/15/15 date boundaries as the baseline so the ablation table compares
identical test windows. Normalization stats are fit on TRAIN windows
only (no test-period leakage).

The single shared 7-day window builder is extract_window() — training,
live inference (api/inference.py) and scenario MUST all use it so live
inputs are transformed identically to training.

Usage:
    python -m src.models.sequence_model --data data/processed/unified_daily.csv
"""

import argparse
import json

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import brier_score_loss, f1_score, precision_score, recall_score

from .baseline_stacking import time_split

WINDOW = 7          # days of history per sample (shared by train + live)
# Strict fold embargo (days): complete 7-day input span + 3-day label span.
# Windows whose end date falls within EMBARGO_DAYS before a fold boundary
# are purged, so NO input day and NO label day is shared across folds.
EMBARGO_DAYS = 10
SEQ_FEATURES = ["rainfall_mm", "rain_3d_mm", "rain_7d_mm", "precip_hours",
                "up_rain_lag1", "up_rain_lag2"]
STATIC_FEATURES = ["elevation_m", "lat", "lon"]
HORIZONS = [1, 2, 3]   # days ahead → 24h/48h/72h


def add_upstream_lags(df: pd.DataFrame, use_upstream: bool = True) -> pd.DataFrame:
    """Lagged upstream-station rainfall: spatial propagation features.

    For each station, mean rainfall of its upstream neighbors shifted
    1 and 2 days — water (and risk) moves downstream with delay.

    use_upstream=False zeroes the lag columns AFTER computation, so the
    local-only ablation keeps identical shapes/pipeline while carrying
    no upstream signal (fix: previously zeroing before make_windows()
    was silently recomputed away).
    """
    rain = df.pivot_table(index="date", columns="station_id", values="rainfall_mm")
    rain_lag1 = rain.shift(1)
    rain_lag2 = rain.shift(2)
    from ..data.stations import STATION_BY_ID

    def _ups_lags() -> pd.DataFrame:
        rows = []
        present = set(rain.columns)
        for sid, s in STATION_BY_ID.items():
            if sid not in present:
                continue
            ups = [u for u in s["upstream_ids"] if u in present]
            if ups:  # mean rainfall over upstream neighbors, lagged
                rows.append(pd.DataFrame({
                    "date": rain.index,
                    "station_id": sid,
                    "up_rain_lag1": rain_lag1[ups].mean(axis=1).to_numpy(),
                    "up_rain_lag2": rain_lag2[ups].mean(axis=1).to_numpy(),
                }))
            else:  # ridge/headwater station: own lag as a weak proxy
                rows.append(pd.DataFrame({
                    "date": rain.index,
                    "station_id": sid,
                    "up_rain_lag1": rain_lag1[sid].to_numpy(),
                    "up_rain_lag2": rain_lag2[sid].to_numpy(),
                }))
        return pd.concat(rows, ignore_index=True)

    df = df.merge(_ups_lags(), on=["date", "station_id"], how="left")
    # first 1-2 days of each series have no lag available → treat as 0
    df[["up_rain_lag1", "up_rain_lag2"]] = df[["up_rain_lag1", "up_rain_lag2"]].fillna(0.0)
    if not use_upstream:
        df[["up_rain_lag1", "up_rain_lag2"]] = 0.0
    return df


def extract_window(g: pd.DataFrame, end_pos: int, window: int = WINDOW) -> pd.DataFrame:
    """Shared 7-day input builder: exactly `window` rows ending at end_pos.

    `g` must be sorted by date with a reset RangeIndex; `end_pos` is the
    integer position of the window END day (inclusive). Returns rows
    [end_pos-window+1, end_pos] — always `window` rows. Training
    (make_windows), live inference and scenario MUST all use this so
    live inputs match training shape (fixes the live 8-row bug where
    g.loc[end-window:end] sliced 8 rows inclusive).
    """
    start = end_pos - window + 1
    if start < 0:
        raise ValueError(f"insufficient history: end_pos={end_pos}, window={window}")
    return g.iloc[start:end_pos + 1]


def make_windows(df: pd.DataFrame, use_upstream: bool = True,
                 embargo: int = EMBARGO_DAYS):
    """Build (N, WINDOW, F) sequences + static matrix + 3 horizon labels.

    Returns (X_seq, X_static, y, dates, sids, stats) — `stats` carries the
    normalization constants, persisted by main() so the inference API
    transforms live inputs identically to training.

    Train-only scaling: stats are fit on windows whose end date falls in
    the chronological TRAIN fold (70% of unique dates, minus `embargo`
    days at the boundary). With the 10-day embargo no input day and no
    label day is shared across folds (see fold_masks). Previously stats
    were fit on the full dataframe (leakage) — fixed.

    use_upstream=False builds the local-only ablation variant: lag
    columns are zeroed after computation so shapes stay identical.
    """
    df = add_upstream_lags(df, use_upstream=use_upstream)
    df[["up_rain_lag1", "up_rain_lag2"]] = df[["up_rain_lag1", "up_rain_lag2"]].fillna(0.0)

    # --- collect unnormalized windows first ---
    seq_list, stat_list, y_list, dates_list, sids_list = [], [], [], [], []
    for sid, g in df.groupby("station_id"):
        g = g.sort_values("date").reset_index(drop=True)
        lab = g["flood_label"].to_numpy()
        d = g["date"].to_numpy()
        n = len(g)
        for i in range(WINDOW - 1, n - max(HORIZONS)):
            win = extract_window(g, i)  # exactly WINDOW rows ending at i
            seq_list.append(win[SEQ_FEATURES].to_numpy(dtype=np.float32))
            stat_list.append(g[STATIC_FEATURES].iloc[0].to_numpy(dtype=np.float32))
            y_list.append([int(lab[i + 1:i + 1 + h].max()) for h in HORIZONS])
            dates_list.append(d[i])
            sids_list.append(sid)
    # NOTE: label window is (i+1 .. i+h): strictly FUTURE days after the
    # window end — the model never sees the days it predicts.

    dates_arr = pd.to_datetime(pd.Series(dates_list))
    uniq = sorted(dates_arr.unique())
    train_end = pd.Timestamp(uniq[int(len(uniq) * 0.70)])
    train_end_emb = train_end - pd.Timedelta(days=embargo)
    train_mask = dates_arr <= train_end_emb
    if int(train_mask.sum()) == 0:  # tiny/degenerate input — fall back to all rows
        train_mask = pd.Series([True] * len(dates_arr))

    seq_all = np.stack(seq_list)
    stat_all = np.stack(stat_list)
    seq_mu = seq_all[train_mask.to_numpy()].reshape(-1, len(SEQ_FEATURES)).mean(axis=0)
    seq_sd = seq_all[train_mask.to_numpy()].reshape(-1, len(SEQ_FEATURES)).std(axis=0)
    seq_sd = np.where(seq_sd == 0, 1.0, seq_sd)
    st_mu = stat_all[train_mask.to_numpy()].mean(axis=0)
    st_sd = stat_all[train_mask.to_numpy()].std(axis=0)
    st_sd = np.where(st_sd == 0, 1.0, st_sd)
    stats = {
        "seq_mu": pd.Series(seq_mu).tolist(), "seq_sd": pd.Series(seq_sd).tolist(),
        "st_mu": pd.Series(st_mu).tolist(), "st_sd": pd.Series(st_sd).tolist(),
        "fit": "train-only", "embargo_days": embargo,
    }

    X_seq = ((seq_all - seq_mu) / seq_sd).astype(np.float32)
    X_static = ((stat_all - st_mu) / st_sd).astype(np.float32)
    return (X_seq, X_static, np.array(y_list, dtype=np.float32),
            dates_arr, np.array(sids_list), stats)


class FloodGRU(nn.Module):
    def __init__(self, n_seq=len(SEQ_FEATURES), n_static=len(STATIC_FEATURES),
                 hidden=48, layers=1):
        super().__init__()
        self.gru = nn.GRU(n_seq, hidden, num_layers=layers, batch_first=True)
        self.static_net = nn.Sequential(nn.Linear(n_static, 16), nn.ReLU())
        self.head = nn.Sequential(nn.Linear(hidden + 16, 32), nn.ReLU(),
                                  nn.Dropout(0.2), nn.Linear(32, len(HORIZONS)))

    def forward(self, x_seq, x_static):
        out, _ = self.gru(x_seq)
        z = torch.cat([out[:, -1], self.static_net(x_static)], dim=1)
        return torch.sigmoid(self.head(z))   # (B, 3) probabilities


def fold_masks(dates, embargo: int = EMBARGO_DAYS):
    """Boolean train/val/test masks over window END dates with strict embargo.

    Same 70/15/15 date boundaries everywhere. A window belongs to the
    earlier fold only if its end date is at least `embargo` days before
    the boundary. With EMBARGO_DAYS=10 (7-day input + 3-day label span),
    the full date span [end-6, end+3] of any two windows in different
    folds is disjoint: no shared input day, no shared label day.
    """
    d = pd.Series(pd.to_datetime(dates)).reset_index(drop=True)
    uniq = sorted(d.unique())
    n = len(uniq)
    train_end = pd.Timestamp(uniq[int(n * 0.70)])
    val_end = pd.Timestamp(uniq[int(n * 0.85)])
    emb = pd.Timedelta(days=embargo)
    train_mask = d <= (train_end - emb)
    val_mask = (d > train_end) & (d <= (val_end - emb))
    test_mask = d > val_end
    return train_mask, val_mask, test_mask


def train_split(X_seq, X_static, y, dates, embargo: int = EMBARGO_DAYS):
    """Chronological split on window END dates with strict fold embargo.

    Same 70/15/15 date boundaries as the baseline. The 10-day embargo
    (7-day input span + 3-day label span) guarantees disjoint input AND
    label date spans across folds — see fold_masks.
    """
    d = pd.Series(pd.to_datetime(dates)).reset_index(drop=True)
    order = d.argsort()
    X_seq, X_static, y, d = X_seq[order], X_static[order], y[order], d.iloc[order].reset_index(drop=True)
    train_mask, val_mask, test_mask = fold_masks(d, embargo)
    tr = (X_seq[train_mask.to_numpy()], X_static[train_mask.to_numpy()], y[train_mask.to_numpy()])
    va = (X_seq[val_mask.to_numpy()], X_static[val_mask.to_numpy()], y[val_mask.to_numpy()])
    te = (X_seq[test_mask.to_numpy()], X_static[test_mask.to_numpy()], y[test_mask.to_numpy()])
    return tr, va, te


def evaluate(model, split, name, thr=0.5):
    model.eval()
    X_seq, X_static, y = split
    with torch.no_grad():
        p = model(torch.from_numpy(X_seq), torch.from_numpy(X_static)).numpy()
    out = {"split": name, "n": len(y)}
    for k, h in enumerate(HORIZONS):
        pred = (p[:, k] >= thr).astype(int)
        out[f"f1_{24*h}h"] = f1_score(y[:, k], pred, zero_division=0)
        out[f"precision_{24*h}h"] = precision_score(y[:, k], pred, zero_division=0)
        out[f"recall_{24*h}h"] = recall_score(y[:, k], pred, zero_division=0)
        out[f"brier_{24*h}h"] = brier_score_loss(y[:, k], p[:, k])
    return out, p


def main(data_path, epochs=15, bs=256, lr=1e-3, out="docs/sequence_metrics.json"):
    df = pd.read_csv(data_path, parse_dates=["date"])
    X_seq, X_static, y, dates, sids, stats = make_windows(df)
    print(f"windows: {len(y)} | positives per horizon:",
          {f"{24*h}h": int(y[:, i].sum()) for i, h in enumerate(HORIZONS)})

    tr, va, te = train_split(X_seq, X_static, y, dates)

    torch.manual_seed(42)
    model = FloodGRU()
    pos_w = torch.tensor(np.maximum(1.0, (len(tr[2]) / (tr[2].sum(0) + 1))),
                         dtype=torch.float32)
    lossf = nn.BCELoss(reduction="none")

    opt = torch.optim.Adam(model.parameters(), lr=lr)
    Xtr = torch.from_numpy(tr[0]); Str = torch.from_numpy(tr[1]); Ytr = torch.from_numpy(tr[2])
    Xva = torch.from_numpy(va[0]); Sva = torch.from_numpy(va[1]); Yva = torch.from_numpy(va[2])

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
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            tot += loss.item() * len(idx)
        va_metrics, _ = evaluate(model, va, "val")
        print(f"epoch {ep+1:2d}  train_loss={tot/len(Xtr):.4f}  "
              f"val f1_24h={va_metrics['f1_24h']:.3f}  f1_72h={va_metrics['f1_72h']:.3f}")

    test_metrics, p_test = evaluate(model, te, "test")
    print("\n=== SEQUENCE MODEL — held-out test ===")
    print(json.dumps(test_metrics, indent=2))

    torch.save(model.state_dict(), "data/processed/flood_gru_v1.pt")
    stats.update({
        "window": WINDOW,
        "embargo_days": EMBARGO_DAYS,
        "label": "heuristic_rainfall_proxy_future_window",
        "horizons": HORIZONS,
        "seq_features": SEQ_FEATURES,
        "static_features": STATIC_FEATURES,
    })
    with open("data/processed/norm_stats.json", "w") as f:
        json.dump(stats, f)
    with open(out, "w") as f:
        json.dump(test_metrics, f, indent=2)
    print("model → data/processed/flood_gru_v1.pt | metrics →", out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/processed/unified_daily.csv")
    ap.add_argument("--epochs", type=int, default=15)
    args = ap.parse_args()
    main(args.data, args.epochs)
