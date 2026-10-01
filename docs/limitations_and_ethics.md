# Limitations and Ethics

## Known Limitations

### 1. Label quality (CRITICAL)

The current `flood_label` is a **heuristic rainfall proxy**, not observed
flood events. Every metric reported is pipeline-validation only. The system
has NOT been validated on real flood outcomes until INDOFLOODS labels are
joined.

### 2. Spatial resolution

District HQ coordinates are used as proxy points for gridded rainfall.
Actual rainfall varies significantly within a district, especially in
mountainous terrain (Western Ghats). The system provides district-level
risk, not point-specific or inundation-level forecasts.

### 3. Upstream relationships

Upstream station adjacency is approximate, based on elevation and river
geography. It is NOT an official CWC catchment topology. Some relationships
may be incorrect or missing.

### 4. Missing hydrological inputs

- `river_discharge_m3s` = 0.0 (placeholder)
- `water_level_m` = 0.0 (placeholder)

Real flood risk depends on antecedent soil moisture, river levels, dam
releases, tidal conditions, and drainage capacity — none of which are
currently modeled.

### 5. No dam-release or tidal inputs

Maharashtra has significant dam infrastructure (Koyna, Krishna-basin
dams) and tidal influence (Konkan coast). Dam releases can cause flooding
without exceptional rainfall; tidal conditions can exacerbate coastal
flooding. These are not modeled.

### 6. Data freshness

The Open-Meteo archive API lags 2-3 days. Live inference uses the forecast
API which may differ from archive quality. Data freshness affects prediction
reliability.

### 7. Single-model evaluation

Only one GRU architecture is evaluated. No ensemble, no cross-validation,
no hyperparameter search. Results may be sensitive to random seed and
architecture choices.

## Ethical Considerations

### 1. Not an official warning system

FloodSense is a **prototype decision-support tool**, not an official
emergency-warning authority. It should never be used as the sole basis for
evacuation or life-safety decisions.

### 2. Alert safety

WhatsApp alerts are a **controlled prototype**. They include:

- Explicit "SIMULATED WARNING" label
- Data-confidence indicator
- Recommended monitoring action (not evacuation orders)
- No automatic emergency advice

### 3. False sense of security

A low-risk tier does NOT mean "safe." The system may miss floods caused by:

- Dam releases
- Local drainage failures
- Tidal conditions
- Unusual antecedent soil moisture
- Rainfall below the proxy threshold but above local capacity

### 4. Population exposure

Population figures (Census 2011) are used for **impact summaries only**,
never as model features. "Population in high-risk districts" is an
approximation, not an exposure estimate.

### 5. Data bias

- Training data covers 5 years — may not capture rare extreme events
- Open-Meteo reanalysis may under-represent localized convective storms
- District-level averaging smooths out sub-district variation

### 6. Transparency

The system explicitly exposes:

- Model vs. fallback status
- Data confidence (measured vs. interpolated)
- Missing data indicators
- Limitations in every prediction response
- Heuristic-label caveat in the dashboard footer

## Claims the project DOES make

- Multi-horizon risk probability from a 7-day sequence window
- Upstream spatial propagation as an input feature
- Calibrated probability tiers via isotonic regression
- Explainable risk drivers (descriptive statistics)
- Historical event replay demonstrating lead-time behavior
- What-if scenario simulation for planning

## Claims the project does NOT make

- Guaranteed flood forecasting
- Automated evacuation recommendations
- Inundation mapping or flood-extent prediction
- Real-time river-level monitoring
- Accuracy on real flood events (until INDOFLOODS join)
- Operational readiness
