# Demo Script

## Setup

1. Start the backend:
   ```bash
   .venv/bin/uvicorn api.main:app --port 8000
   ```

2. Start the frontend:
   ```bash
   cd frontend && npm run dev
   ```

3. Open http://localhost:5173 in a browser.

## Demo Flow (10 minutes)

### Part 1: Problem & Positioning (2 min)

**Say**: "FloodSense is a flood early-warning decision-support system for
Maharashtra. It answers: which district is becoming risky, how soon, why,
and how confident are we?"

**Show**: The risk map with all 36 districts, colored by tier.

**Say**: "This is not a weather app. It converts rainfall conditions into
calibrated 24/48/72-hour flood-risk probabilities, with upstream spatial
propagation."

### Part 2: Risk Map & District Detail (2 min)

**Do**: Click on a district with elevated risk (or the highest-risk district).

**Show**:
- Risk gauge with 24/48/72h probabilities
- "Why this risk" drivers section
- Data confidence indicator
- Rainfall outlook chart

**Say**: "Each prediction comes with explainable drivers — the officer can
see exactly why the system is flagging this district."

### Part 3: Horizon Selection (1 min)

**Do**: Switch between 24h, 48h, 72h horizons on the map.

**Say**: "The same model produces three lead times. Longer horizons are
more conservative — higher precision, lower recall. This is the expected
behavior for a lead-time forecaster."

### Part 4: Historical Event Replay (3 min)

**Do**:
1. Click "Historical Replay" in the sidebar
2. Select "Palghar deluge — July 23, 2026"
3. Click play to step through the replay

**Show**:
- Risk rising over the 72 hours before the event
- Upstream rainfall increasing first, downstream risk following
- The GRU flagging risk earlier than a simple rainfall threshold
- The actual event onset overlaid

**Say**: "This is the key differentiator. A rainfall map shows rain.
FloodSense shows the risk trajectory — and would have provided
[X hours] of useful warning time."

### Part 5: Scenario Tool (1 min)

**Do**:
1. Go to a district detail view
2. Use the what-if simulator: set 150mm rainfall
3. Show the risk change

**Say**: "Officers can test hypothetical scenarios — 'what if 150mm falls
tomorrow?' — and see how risk changes. This supports planning."

### Part 6: Alert Workflow (1 min)

**Do**:
1. Show the subscribe form
2. Trigger a manual cycle: `curl -X POST localhost:8000/api/cron/run`
3. Show the alert message format

**Say**: "Alerts are a prototype delivery channel. They include data
confidence, model status, and safety disclaimers. The contribution is the
validated risk assessment, not the alert itself."

### Part 7: Limitations & Future Work (1 min)

**Say**: "Important limitations:
- Labels are currently a rainfall proxy, not verified flood events
- River discharge data is placeholder
- Upstream relationships are approximate
- This is a prototype, not an operational system

Future work: join INDOFLOODS verified labels, add CWC gauge data,
expand to more basins."

## Key Messages

1. **Differentiation**: This is a decision-support system, not a weather map
2. **Evidence**: Every prediction comes with explainable drivers
3. **Replay**: Historical events demonstrate lead-time behavior
4. **Honesty**: Limitations are explicit and documented
5. **Safety**: Alerts are prototype/simulated, never automatic evacuation
