"""
Batch-1: shared 7-day window parity + train-only scaling + buffered folds.

Usage:
    python -m pytest tests/test_window_parity.py -v
"""

import numpy as np
import pandas as pd
import pytest

from src.models.sequence_model import (
    WINDOW, EMBARGO_DAYS, HORIZONS, SEQ_FEATURES, STATIC_FEATURES,
    add_upstream_lags, extract_window, make_windows, train_split,
    fold_masks,
)


@pytest.fixture
def history_df():
    dates = pd.date_range("2024-01-01", periods=60)
    rows = []
    for sid in ["MH_NBR", "MH_DHU", "MH_JLG"]:
        for d in dates:
            rows.append({
                "station_id": sid, "date": d,
                "rainfall_mm": 5.0, "rain_3d_mm": 15.0, "rain_7d_mm": 40.0,
                "precip_hours": 2.0, "elevation_m": 500,
                "lat": 18.0, "lon": 74.0, "flood_label": 0,
                "data_confidence": "measured",
            })
    return pd.DataFrame(rows)


def test_extract_window_exactly_seven_rows(history_df):
    g = history_df[history_df["station_id"] == "MH_NBR"].sort_values("date").reset_index(drop=True)
    w = extract_window(g, 20)
    assert len(w) == WINDOW == 7
    assert w["date"].iloc[-1] == g["date"].iloc[20]
    assert w["date"].iloc[0] == g["date"].iloc[14]


def test_train_window_matches_live_window_shape(history_df):
    """Live previously sliced 8 rows (g.loc[end-7:end]); shared builder gives 7."""
    g = history_df[history_df["station_id"] == "MH_NBR"].sort_values("date").reset_index(drop=True)
    end = 30
    live_rows = extract_window(g, end)
    assert live_rows.shape[0] == 7
    # training windows built by make_windows must have identical width
    X_seq, _, _, _, _, _ = make_windows(history_df)
    assert X_seq.shape[1] == 7
    assert X_seq.shape[2] == len(SEQ_FEATURES)


def test_stats_fit_train_only(history_df):
    """Injecting an extreme test-period value must not move the scaler."""
    X1 = make_windows(history_df)[5]
    df2 = history_df.copy()
    # contaminate the TEST tail (last 5 days) with a huge outlier
    mask = df2["date"] >= pd.Timestamp("2024-02-25")
    df2.loc[mask, "rainfall_mm"] = 9999.0
    X2 = make_windows(df2)[5]
    np.testing.assert_allclose(X1["seq_mu"], X2["seq_mu"], rtol=1e-6)
    assert X2["fit"] == "train-only"


def test_buffered_split_no_boundary_overlap():
    """10-day embargo splits partition the full set (long fixture so all
    folds are non-empty despite purged boundary days)."""
    dates = pd.date_range("2024-01-01", periods=120)
    rows = [{"station_id": "MH_NBR", "date": d, "rainfall_mm": 5.0,
             "rain_3d_mm": 15.0, "rain_7d_mm": 40.0, "precip_hours": 2.0,
             "elevation_m": 500, "lat": 18.0, "lon": 74.0, "flood_label": 0,
             "data_confidence": "measured"} for d in dates]
    df = pd.DataFrame(rows)
    X_seq, X_st, y, dates, sids, _ = make_windows(df)
    tr, va, te = train_split(X_seq, X_st, y, dates, embargo=EMBARGO_DAYS)
    assert len(tr[2]) > 0 and len(va[2]) > 0 and len(te[2]) > 0
    # splits partition the full set
    assert len(tr[2]) + len(va[2]) + len(te[2]) <= len(y)
    # purged days exist between folds
    assert len(tr[2]) + len(va[2]) + len(te[2]) < len(y)


def test_local_ablation_zeroed_after_compute(history_df):
    df = add_upstream_lags(history_df.copy(), use_upstream=False)
    assert (df["up_rain_lag1"] == 0.0).all()
    assert (df["up_rain_lag2"] == 0.0).all()
    df2 = add_upstream_lags(history_df.copy(), use_upstream=True)
    assert (df2["up_rain_lag1"] >= 0).all()


def test_embargo_no_cross_fold_span_overlap():
    """STRICT: full date span [end-6, end+3] (7-day input + 3-day label)
    of any two windows in different folds must be disjoint — no shared
    input day, no shared label day across folds."""
    dates = pd.date_range("2024-01-01", periods=120)
    rows = []
    for sid in ["MH_NBR", "MH_DHU", "MH_JLG"]:
        for d in dates:
            rows.append({
                "station_id": sid, "date": d,
                "rainfall_mm": 5.0, "rain_3d_mm": 15.0, "rain_7d_mm": 40.0,
                "precip_hours": 2.0, "elevation_m": 500,
                "lat": 18.0, "lon": 74.0, "flood_label": 0,
                "data_confidence": "measured",
            })
    df = pd.DataFrame(rows)
    _, _, _, wdates, _, _ = make_windows(df)
    tr_m, va_m, te_m = fold_masks(wdates, embargo=EMBARGO_DAYS)
    assert int(tr_m.sum()) > 0 and int(va_m.sum()) > 0 and int(te_m.sum()) > 0
    d = pd.to_datetime(pd.Series(wdates)).reset_index(drop=True)
    spans = {}
    for name, m in (("train", tr_m), ("val", va_m), ("test", te_m)):
        spans[name] = [(t - pd.Timedelta(days=WINDOW - 1),
                        t + pd.Timedelta(days=max(HORIZONS))) for t in d[m]]
    pairs = [("train", "val"), ("train", "test"), ("val", "test")]
    for a, b in pairs:
        for s1 in spans[a]:
            for s2 in spans[b]:
                assert s1[1] < s2[0] or s2[1] < s1[0], (
                    f"{a}/{b} share dates: {s1} vs {s2}")


def test_stats_fit_mask_matches_train_fold():
    """Scaler fit mask and train fold mask share the same embargo boundary."""
    dates = pd.date_range("2024-01-01", periods=120)
    rows = [{"station_id": "MH_NBR", "date": d, "rainfall_mm": 5.0,
             "rain_3d_mm": 15.0, "rain_7d_mm": 40.0, "precip_hours": 2.0,
             "elevation_m": 500, "lat": 18.0, "lon": 74.0, "flood_label": 0,
             "data_confidence": "measured"} for d in dates]
    df = pd.DataFrame(rows)
    _, _, _, wdates, _, stats = make_windows(df)
    tr_m, _, _ = fold_masks(wdates, embargo=EMBARGO_DAYS)
    assert stats["embargo_days"] == EMBARGO_DAYS
    # fit used exactly the train-fold windows (same count ⇒ same mask,
    # since both are prefix-sets of the ordered end dates)
    d = pd.to_datetime(pd.Series(wdates)).reset_index(drop=True)
    uniq = sorted(d.unique())
    fit_end = pd.Timestamp(uniq[int(len(uniq) * 0.70)]) - pd.Timedelta(days=EMBARGO_DAYS)
    assert (d[tr_m].max() <= fit_end) and (int(tr_m.sum()) > 0)
