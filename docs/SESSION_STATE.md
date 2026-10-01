# FloodSense session state (pause closeout, 2026-10-10)

## Blocker (unchanged)
Real-label training BLOCKED: Zenodo 14584655 ships aggregate counts +
event rows only, no daily gauge series; absence of an event is NOT a
verified negative. See docs/indofloods_audit_report.md (verdict BLOCKED).

## Changes this session (uncommitted, local only)
- Shared 7-day window builder (train == live == scenario); fixed live 8-row bug.
- Train-only scaling; strictly-future labels; compat gate in load_bundle.
- Isotonic calibration DISABLED (mixed Brier deltas); provisional tiers served.
- Experimental rainfall-risk wording EN+MR; no evacuation orders; stale/
  source/as-of provenance in API + stale banner in UI; drivers crash fixed.
- Regenerated flood_gru_v1.pt + norm_stats.json + calibration.json + metrics.

## Embargo + tests
10-day embargo (7-day input + 3-day label span); cross-fold spans proven
disjoint (test_embargo_no_cross_fold_span_overlap). Suite: 70 passed.
tsc clean, vite build OK.

## Metrics (heuristic proxy labels, test n=9520)
F1 24h 0.750 (P 0.96 / R 0.615) | 48h 0.641 | 72h 0.570. Calibration 24h
Brier 0.00293 -> 0.00283, alert-F1 ~0.52-0.54. Tiers provisional, not CWC.

## Paper caveats (docs/paper_caveats.md)
TNNLS ResTCN-DAM = framing inspiration, NOT extension. HAORGNN unverified,
motivation only. No MSEED citation invented. No GNN implemented.

## Remaining
1. Simple TCN baseline (same windows/folds). 2. Real daily gauge labels.
3. Gauge-request draft to HydroSense Lab, IIT Delhi (Karad/Kurundwad/Takli).

## Backup / status / resume
- Backup: stash@{0} batch1-backup-2026-10-10 (pre-batch). HEAD ab1ad09,
  master in sync with origin. No push/deploy/sends. Stale /tmp copies kept.
- Screenshots: /tmp/floodsense-shots/ (01,02,03,04 + contact sheet).
- Resume: `.venv/bin/python -m pytest tests/ -q`
  `.venv/bin/uvicorn api.main:app --port 8000` (+ `vite preview` in frontend)
- Note: fresh CRD code needed; Google login active.
- Independent reviewer pixel inspection remains unverified.
