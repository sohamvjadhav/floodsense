# Problem Statement

## Background

Maharashtra experiences recurring monsoon flooding that damages infrastructure,
displaces communities, and strains disaster-response capacity. Existing
operational tools — IMD district-level warnings, CWC river-gauge bulletins,
and mobile weather apps — answer "where and how much will it rain?" but do
not directly provide calibrated, lead-time flood-event risk or explain
upstream-to-downstream risk propagation.

## Problem

District disaster-management officers currently make monitoring and escalation
decisions based on raw rainfall amounts, static danger-level thresholds, and
personal judgment. This process lacks:

1. **Temporal risk projection** — a probability estimate of flood-risk onset
   within an actionable window (24, 48, 72 hours).
2. **Spatial propagation awareness** — upstream rainfall conditions that
   may increase downstream risk hours or days later.
3. **Explainable evidence** — a clear indication of *why* a district is
   flagged, how confident the system is, and what data is missing.
4. **Decision-support workflow** — a structured path from risk detection to
   monitoring escalation, not an automated evacuation order.

## Research Question

> Can recent rainfall accumulation and upstream spatial-lag features improve
> the timing and usefulness of district-level flood-risk warnings compared
> with static rainfall thresholds and conventional machine-learning baselines?

## Proposed Solution

FloodSense is a calibrated, lead-time flood-risk decision-support prototype
for a selected Maharashtra pilot area. It integrates:

- Temporal rainfall forecasting (GRU over a 7-day sequence window)
- Approximate upstream-to-downstream propagation via lagged neighbor features
- Calibrated 24/48/72-hour risk tiers (Low/Medium/High/Severe)
- Explainable risk drivers with data-quality indicators
- Historical event replay and what-if scenario simulation
- WhatsApp alert delivery as a controlled prototype

## Scope

- **Geography**: Maharashtra statewide (36 districts across Godavari,
  Krishna, Konkan, and Tapi basins)
- **Primary user**: District disaster-management officers deciding whether
  to increase monitoring or issue a warning
- **Claim**: Risk decision support, not guaranteed flood forecasting or
  automated evacuation advice
- **Validation**: Currently on a rainfall-extreme proxy label; designed for
  re-evaluation against verified INDOFLOODS event labels

## Success Criteria

By the final evaluation, the evaluator should understand in two minutes:

> FloodSense does not merely display rain. It estimates how rainfall
> conditions may evolve into district-level risk, shows the expected time
> horizon and causes, demonstrates the warning process on a historical event,
> and clearly distinguishes validated evidence from prototype assumptions.
