# Paper Caveats — base and supporting literature

## Base paper (IEEE Transactions, 2024–2026 requirement)

**Sheng et al., "Residual Temporal Convolutional Network With Dual Attention
Mechanism for Multilead-Time Interpretable Runoff Forecasting,"
IEEE Trans. Neural Networks and Learning Systems, DOI
10.1109/TNNLS.2024.3411166 (DOI 2024, print vol.36(5) May 2025).**

- Adopted: multi-lead-time framing (24/48/72h horizons), sequence modeling
  for runoff/rainfall-risk, interpretability motivation (drivers).
- NOT claimed: FloodSense does NOT extend ResTCN-DAM. The base uses
  ResNet + TCN + dual attention on gauged catchment discharge; FloodSense
  v1 uses a 1-layer GRU-48 on gridded rainfall only (discharge columns are
  all-zero placeholders) with heuristic proxy labels. Architecture,
  inputs, and supervision all differ.
- Owed: a simple TCN baseline on identical windows/folds (deferred to a
  later batch — see below) to honor the base-paper link.

## Supporting (NOT base)

- **HAORGNN / PECCII 2026** — UNVERIFIED reference (could not locate).
  Used only as topology motivation IF verified. FloodSense implements NO
  graph message passing: upstream lags are fixed-adjacency means
  (`src/data/stations.py`), not learned. Must never be cited as method.
- **CauStream, IEEE BigData 2025** (Wan et al., arXiv:2512.16046) — causal
  spatio-temporal streamflow forecasting. Supporting lead for moving from
  hand-coded lags toward learned causal graphs. Contrasts with (not
  equated to) current fixed adjacency.
- **MSEED / IEEE Access 2024** — NO CITATION INVENTED. No verifiable
  flood/runoff match found; do not cite until full title/authors/DOI are
  supplied and relevance is confirmed.
- **DeepSTUQ (traffic UQ)** — deliberately excluded (cross-domain base
  invites rejection).

## Method fixes (batch 1 + embargo batch, all in-repo)

- Shared 7-day window builder (`extract_window`) — train == live == scenario.
- Train-only scaling; chronological 70/15/15 split with strict **10-day
  embargo** (7-day input span + 3-day label span): full [end-6, end+3]
  spans are disjoint across folds — no shared input day, no shared label
  day (proven by `tests/test_window_parity.py::test_embargo_no_cross_fold_span_overlap`).
- Isotonic calibration DISABLED in inference (mixed Brier deltas);
  provisional quantile tiers served as `disabled-provisional`.
- Upstream lags are fixed-adjacency means, NOT a GNN; local-vs-spatial
  ablation reruns on identical embargoed folds.

## Deferred

- Simple TCN baseline (same 7-day windows, embargoed folds, train-only
  scaling) — next modeling batch, after embargo-batch fixes are validated.
- GNN / learned-graph extension — future work after daily gauge records
  unblock real-label training (see `docs/indofloods_audit_report.md`).
