# Data Provenance

## Primary Data Sources

### 1. Open-Meteo Archive API (used now)

- **URL**: https://archive-api.open-meteo.com/v1/archive
- **Variables**: `precipitation_sum`, `precipitation_hours`
- **Coverage**: Global, daily resolution
- **Access**: Free, no API key required
- **Usage**: Training dataset (5 years) + live inference feed
- **Limitations**: Gridded reanalysis, not point gauge; discharge returns
  nulls over India; soil moisture unavailable

### 2. INDOFLOODS (IIT Delhi HydroSense) — pending

- **URL**: https://hydrosense.iitd.ac.in/resources/
- **Type**: Verified flood-event labels
- **Usage**: Replace heuristic rainfall proxy with observed flood events
- **Status**: Pending manual download and join
- **Priority**: CRITICAL — all metrics must be re-run after this join

### 3. CWC Gauge Records — pending

- **Type**: River discharge and water-level measurements
- **Usage**: Replace zero-placeholder `river_discharge_m3s` and `water_level_m`
- **Status**: Not yet obtained

### 4. Kaggle Flood Risk India — supplementary

- **Type**: Labeled flood-risk data
- **Usage**: Supplementary validation only, clearly labeled as such

### 5. IMD Mausam/NDSAP — planned

- **Type**: Departure-from-normal rainfall features
- **Usage**: Additional feature engineering

## Station Registry

- **36 districts** across 4 basins (Godavari, Krishna, Konkan, Tapi)
- Coordinates: District HQ lat/lon (Census 2011 boundaries)
- Elevation: District HQ elevation
- Population: Census 2011 (for exposure summaries only, never as model feature)
- Upstream adjacency: Approximate, based on elevation + river geography

## Feature Derivation

| Feature | Source | Derivation |
|---------|--------|------------|
| `rainfall_mm` | Open-Meteo | Direct API field |
| `rain_3d_mm` | Open-Meteo | 3-day rolling sum |
| `rain_7d_mm` | Open-Meteo | 7-day rolling sum |
| `precip_hours` | Open-Meteo | Direct API field |
| `up_rain_lag1` | Computed | Mean upstream rainfall, shifted 1 day |
| `up_rain_lag2` | Computed | Mean upstream rainfall, shifted 2 days |
| `elevation_m` | Station registry | District HQ elevation |
| `lat`, `lon` | Station registry | District HQ coordinates |

## Placeholder Fields

| Field | Current Value | Reason | Resolution |
|-------|--------------|--------|------------|
| `river_discharge_m3s` | 0.0 | Open-Meteo returns nulls over India | Join CWC gauge data |
| `water_level_m` | 0.0 | Open-Meteo returns nulls over India | Join CWC gauge data |

## Label Definition

### Current: Heuristic rainfall proxy

```
flood_label = (rainfall_mm >= 115) OR (rain_3d_mm >= 150)
```

- 115mm = IMD "extremely heavy" rainfall threshold
- 150mm = 3-day sustained heavy rain threshold
- **NOT observed flood events** — a deterministic function of inputs

### Planned: Verified flood-event labels

After INDOFLOODS join:

```
At issue time t, predict whether a verified flood-event onset occurs
within the next 24, 48, or 72 hours in the monitored area.
```

## Data Quality Flags

- `data_confidence = "measured"`: Raw API rainfall
- `data_confidence = "interpolated"`: Gap-filled via within-station
  time interpolation (never silent)

## Dataset Versioning

Each experiment records:

- Date range of training data
- Number of stations
- Number of station-days
- Label source (heuristic / INDOFLOODS)
- Label positive rate
