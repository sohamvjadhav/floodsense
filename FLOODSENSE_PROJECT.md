# FloodSense: ML-Based Flood Early Warning System for Maharashtra

**Author:** Soham Jadhav · **Date:** September 2026 · **Repository:** github.com/sohamvjadhav/floodsense

> FloodSense converts recent rainfall and upstream river-basin signals into district-level flood-risk tiers for the next 24, 48, and 72 hours, and delivers them through a web dashboard, an Android application, and WhatsApp alerts.

---

## Executive Summary

| Item | Detail |
|---|---|
| **Problem** | Monsoon floods in Maharashtra cause recurring damage and displacement. Existing warnings report rainfall amounts but do not give calibrated, location-specific flood risk with lead time. |
| **Solution** | A decision-support prototype: a sequence model reviews the last 7 days per district and outputs risk probabilities at 3 horizons, calibrated into Low / Medium / High / Severe tiers. |
| **Coverage** | 35 districts (one station each) across 4 basins: Godavari (17), Tapi (7), Konkan (6), Krishna (5). Mumbai City and Suburban are merged into one unit. |
| **Delivery** | Web dashboard (React + Leaflet), Android field app (Expo React Native), WhatsApp opt-in alerts (Twilio), automated refresh cycle. |
| **State** | End-to-end system runs locally and is deployable. Model metrics below are on rainfall-derived proxy labels; re-validation on verified flood-event records is the explicit next step. |

---

## 1. The Problem

District disaster-management officers currently work from raw rainfall totals, static danger thresholds, and personal judgment. Four gaps result:

1. **No forward-looking risk.** Rainfall totals describe the present, not the probability of flooding in 1–3 days.
2. **No upstream context.** Rain upstream can raise downstream risk a day or two later; current tools do not show this link.
3. **No explanation.** A flagged district comes with no statement of why, how confident the system is, or what data is missing.
4. **No structured workflow.** There is no guided path from first signal to monitoring escalation.

FloodSense addresses exactly these four points. It is a **decision aid, never an evacuation authority** — final calls stay with the responsible officer.

---

## 2. How the System Works

### 2.1 Data pipeline

Open-Meteo archive data (daily rainfall and rain hours, free API, no key) is pulled per district headquarters and unified into one daily table (`data/processed/unified_daily.csv`, 17 columns). Derived signals include 3-day and 7-day rainfall accumulations plus **upstream lags**: the average rainfall of upstream neighbours shifted by 1 and 2 days, computed from an approximate river adjacency table (`src/data/stations.py`).

Transparency rules built into the pipeline:

- Every day is flagged `measured` or gap-filled `interpolated` — gap-filling is never silent.
- River discharge and water level are currently **zero placeholders** (the archive API returns none over India). Joining Central Water Commission gauge data is a listed next step.
- The upstream neighbour map is an **approximation from elevation and river geography**, not an official catchment survey. This is stated in the code, docs, and UI-adjacent documentation.

Current training labels are a **rainfall proxy** (24h ≥ 115 mm, the IMD "extremely heavy" mark, or 3-day ≥ 150 mm) — not observed floods. A schema for verified event labels (source, district, onset date, confidence, per-horizon labels) exists alongside it, with two events logged (Palghar July 2026, Kolhapur June 2024), ready for the label swap.

### 2.2 Model

One network, `FloodGRU` (`src/models/sequence_model.py`):

- **Temporal branch:** single-layer GRU (hidden size 48) over a 7-day window of 6 features (rainfall, 3-day sum, 7-day sum, rain hours, upstream lag-1, upstream lag-2).
- **Static branch:** small network (3 → 16) on elevation, latitude, longitude.
- **Head:** 64 → 32 → 3 outputs with sigmoid: P(risk) at 24h, 48h, 72h.
- **Discipline:** the model never sees current-day or future rain — only the 7 days ending at the cutoff. That is the entire lead-time claim, and the reason a same-day baseline is kept purely as an ablation reference.

Training: class-weighted loss, Adam (learning rate 1e-3), chronological 70/15/15 date split with no shuffling, seed 42.

### 2.3 Calibration into public tiers

Raw probabilities are mapped through isotonic regression fitted on the validation window only, then grouped by validation percentiles (90th / 97th / 99.5th):

| Tier | Public guidance | Officer action |
|---|---|---|
| Low | Conditions normal | Routine monitoring |
| Medium | Stay updated, avoid waterlogged routes | Monitor more often, verify gauges |
| High | Move valuables uphill, avoid rivers | Notify control room, pre-position resources |
| Severe | Leave low-lying areas, follow official instructions | Activate emergency protocols |

### 2.4 Measured performance

Held-out chronological test period (~9,500 district-days), from `docs/sequence_metrics.json`:

| Horizon | Precision | Recall | F1 |
|---|---|---|---|
| 24h | 0.88 | 0.77 | **0.82** |
| 48h | 0.85 | 0.64 | **0.73** |
| 72h | 0.85 | 0.53 | **0.65** |

Reading: warnings are usually correct when issued (precision holds), while coverage falls with horizon (recall decays) — the expected signature of genuine forecasting. The same-day stacking baseline scores F1 ≈ 0.98 on these proxy labels, which validates the pipeline, not flood skill, since the proxy is a deterministic function of its own inputs.

Calibration note: isotonic mapping slightly raised Brier scores on test (e.g. 24h 0.0024 → 0.0026) while enabling the tier system; alert-level F1 for High-or-Severe sits around 0.51–0.59. An older ablation write-up reports slightly different GRU numbers from an earlier run — the table above is from the current committed artifacts.

---

## 3. Web Dashboard

Single-page application (`frontend/src/App.tsx`), React 19 + Leaflet + Recharts, light and dark themes with self-hosted fonts.

- **Map.** Satellite imagery by default (Esri) with place-name overlay; switchable to light/dark vector maps. Two layers: district choropleth filled by tier, or station markers (white halo under a tier disc so they read on imagery; pulsing ring on High/Severe). A horizon switcher (+24h / +48h / +72h) re-colours map, queue, and indicators together.
- **Risk queue.** All districts ranked by current-horizon tier, with a summary strip (districts tracked, count at High+, exposed population).
- **District case file.** Risk gauge, tier guidance, 24/48/72h values, ranked reasons ("rain last 24h at the 94th percentile of its calendar month"), rainfall chart separating observed from forecast days, and a 20-reading risk history chart.
- **Historical replay.** Date picker plus six curated presets (Palghar deluge Jul 2026, Konkan multi-day event Jul 2026, Kolhapur onset Jun 2024, pre-monsoon Konkan storm May 2025, Ratnagiri Aug 2025, Konkan Sep 2021). Day-by-day playback with an operator briefing card, decision timeline, and a lead-time verdict ("warning preceded peak by N days"). Replay runs the model strictly on data available each day — it never sees the future.
- **Scenario lab.** "What if it rains X mm tomorrow?" presets (50–300 mm) plus a slider; shows baseline-versus-scenario tiers per horizon with the point change. Labelled as a drill-planning simulation, not a forecast.
- **Alerts panel.** WhatsApp subscribe/unsubscribe per district with Indian number validation. New numbers must message the Twilio sandbox number to enable delivery — stated in the success message.
- **Model status panel.** Architecture, calibration method, split discipline, and the test-metrics table, one click from the header.

---

## 4. Android Application

Native-feel field app in Expo (SDK 57) / React Native. Package `com.sohamjadhav.floodsense`; demo distribution as a sideloadable APK via EAS preview profile. **All inference stays server-side — the app only calls the API.** Dark operations theme throughout.

| Tab | Contents |
|---|---|
| Map | Google-Maps district circles (24 km radius, white casing, tier fill), 24/48/72h switcher pill, legend; tap a circle opens the case file. |
| Risk queue | Same ranking as web, three summary tiles (districts, High+ count, exposed population), pull-to-refresh, backend health line. |
| Event replay | Event chips, 10-day playback from 6 days before the event, briefing card, peak-risk bar strip, tappable day cells marking first alert vs. observed onset, lead-time verdict banner. |
| Alerts | Opt-in/opt-out toggle, phone field, district chips, submit with inline success/error; prototype disclaimer on screen. |

The **case file** (one screen per district) contains: back navigation, basin and tier badges, risk gauge (semicircle dial), "what to do" guidance, 24/48/72h probability bars with tier badges, station and update counts, ranked reasons with percentile bars, and the scenario lab (preset chips 50–300 mm, 0–300 slider with live recompute, per-horizon baseline→scenario cards highlighting tier jumps).

Two honest technical notes for the recipient: the app currently holds **no offline cache** (data is in-memory; offline appears as an inline message), and there are **no haptic or animation libraries** — feedback is colour, badges, and spinners.

---

## 5. Backend and Operations

Fourteen endpoints served by FastAPI (`api/main.py`), including health, map, district detail, evidence, station history, model info/metrics, replay (single date, date range, event presets), scenario, subscribe/unsubscribe, and a manual refresh trigger. Full API documentation is auto-generated at `/docs` when the server runs.

Reliability behaviour worth knowing:

- If the model or data feed is unavailable, the service degrades to IMD-threshold tiers and marks responses `source: fallback` instead of failing.
- WhatsApp alerts fire only when a district **crosses** from Low/Medium into High/Severe — not on every refresh — and every send is attempted only for active subscribers. Without Twilio credentials the system logs instead of crashing.
- A hardened alert module (6-hour cooldown, simulation mode, masked audit log) exists in the codebase and is covered by tests; wiring it into the live loop is scheduled work, not yet live.
- The refresh job runs every 3 hours in-process (configurable), seeding the database on first start. Local storage is SQLite; production uses Postgres via one environment variable.
- Tests: 9 files (~40 tests) covering features, splits, horizons, API behaviour, replay, calibration, scenario validation, and alert rules. CI runs lint, tests, artifact checks, and the frontend build.

---

## 6. Design Principles

1. **Tiers decide, numbers support.** Probabilities never appear without their tier.
2. **Every warning carries a reason and a timestamp.** No unexplained markers; staleness is visible.
3. **Lead time is explicit.** Screens distinguish "risk now" from "risk in 48 hours."
4. **Actions are reversible.** Unsubscribe and opt-out live next to subscribe; alert limits are stated.
5. **Prototype honesty.** Proxy labels, placeholder gauges, and the approximate upstream map are documented in the repository and one tap away in the app's model information — never blocking, never hidden.

---

## 7. Roadmap

Scheduled engineering ( Plays no part in the evaluation of what exists today):

- Replace proxy labels with verified INDOFLOODS event records and re-run all metrics.
- Join gauge discharge and water-level data, replacing the zero placeholders.
- Wire the hardened alert module (cooldown, simulation, audit) into the live loop.
- Candidate Android additions under consideration (none built): river-flow overlay, time scrubber, officer/citizen dual mode, offline snapshots, Marathi guidance, home-screen widget, safe-ground card, guided onboarding.

---

## 8. Limitations

- Metrics reflect rainfall-proxy prediction, not verified flood skill.
- District-headquarters coordinates stand in for gridded rainfall; sub-district variation (notably the Western Ghats) is lost.
- No dam-release, tidal, drainage, soil-moisture, or inundation-extent modelling.
- Single model, single split — no ensemble or cross-validation yet.
- Archive data lags 2–3 days; live feed behaviour may differ slightly.

---

*Methodology, experiment protocol, data provenance, limitations and ethics, model card, officer workflow, and a 10-minute demonstration script are maintained under `docs/` in the repository. A documentation discrepancy to be aware of: some older markdown files say "36 districts" while the station registry (`src/data/stations.py`, 35 entries) is authoritative at 35.*
