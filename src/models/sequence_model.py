"""
FloodSense sequence model v1 — GRU over a 7-day station window,
multi-horizon (24/48/72h) risk outputs.

Input per timestep (per station):
    rainfall_mm, rain_3d_mm, rain_7d_mm, precip_hours,
    upstream rain lagged 1d, upstream rain lagged 2d (mean over upstreams)

Static branch: elevation_m, lat, lon (normalized) — small feedforward.

Outputs (sigmoid): risk_24h, risk_48h, risk_72h = P(flood-label day
within next 1 / 2 / 3 days). NOTE: with the current heuristic rainfall
label these are rainfall-risk forecasts; re-run after INDOFLOODS join.

The model NEVER sees current-day or future rainfall — unlike the
baseline, which classifies same-day. That is the lead-time contribution.

Time-based split, same 70/15/15 date boundaries as the baseline so the
ablation table compares identical test windows.

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

WINDOW = 7          # days of history per sample
SEQ_FEATURES = ["rainfall_mm", "rain_3d_mm", "rain_7d_mm", "precip_hours",
                "up_rain_lag1", "up_rain_lag2"]
STATIC_FEATURES = ["elevation_m", "lat", "lon"]
HORIZONS = [1, 2, 3]   # days ahead → 24h/48h/72h


def add_upstream_lags(df: pd.DataFrame) -> pd.DataFrame:
    """Lagged upstream-station rainfall: spatial propagation features.

    For each station, mean rainfall of its upstream neighbors shifted
    1 and 2 days — water (and risk) moves downstream with delay.
    """
    rain = df.pivot_table(index="date", columns="station_id", values="rainfall_mm")
    rain_lag1 = rain.shift(1)
    rain_lag2 = rain.shift(2)
    from ..data.stations import STATION_BY_ID

    def _ups_lags() -> pd.DataFrame:
        rows = []
        for sid, s in STATION_BY_ID.items():
            ups = s["upstream_ids"]
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
    return df


def make_windows(df: pd.DataFrame):
    """Build (N, WINDOW, F) sequence tensors + static matrix + 3 horizon labels."""
    df = add_upstream_lags(df)
    # normalize per-feature using full-df stats (documented; recomputed per run)
    seq_mu = df[SEQ_FEATURES].mean()
    seq_sd = df[SEQ_FEATURES].std().replace(0, 1.0)
    st_mu = df[STATIC_FEATURES].mean()
    st_sd = df[STATIC_FEATURES].std().replace(0, 1.0)

    X_seq, X_static, y, dates, sids = [], [], [], [], []
    for sid, g in df.groupby("station_id"):
        g = g.sort_values("date").reset_index(drop=True)
        seq = ((g[SEQ_FEATURES] - seq_mu) / seq_sd).to_numpy(dtype=np.float32)
        stat = ((g[STATIC_FEATURES].iloc[0] - st_mu) / st_sd).to_numpy(dtype=np.float32)
        lab = g["flood_label"].to_numpy()
        d = g["date"].to_numpy()
        n = len(g)
        for i in range(WINDOW, n - max(HORIZONS)):
            X_seq.append(seq[i - WINDOW:i])
            X_static.append(stat)
            y.append([int(lab[i:i + h].max()) for h in HORIZONS])
            dates.append(d[i])
            sids.append(sid)
    return (np.stack(X_seq), np.stack(X_static), np.array(y, dtype=np.float32),
            pd.to_datetime(dates), np.array(sids))


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


def train_split(X_seq, X_static, y, dates):
    """Same chronological boundaries as baseline: by window END date."""
    d = pd.Series(dates)
    order = d.argsort()
    X_seq, X_static, y, d = X_seq[order], X_static[order], y[order], d.iloc[order]
    n = len(d)
    tr, va = int(n * 0.70), int(n * 0.85)
    return (X_seq[:tr], X_static[:tr], y[:tr]), \
           (X_seq[tr:va], X_static[tr:va], y[tr:va]), \
           (X_seq[va:], X_static[va:], y[va:])


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
    X_seq, X_static, y, dates, sids = make_windows(df)
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
    with open(out, "w") as f:
        json.dump(test_metrics, f, indent=2)
    print("model → data/processed/flood_gru_v1.pt | metrics →", out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/processed/unified_daily.csv")
    ap.add_argument("--epochs", type=int, default=15)
    args = ap.parse_args()
    main(args.data, args.epochs)
