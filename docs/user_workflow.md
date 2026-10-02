# User Workflow

## Primary User

District disaster-management officer responsible for monitoring flood risk
and deciding whether to increase monitoring or issue warnings.

## Daily Workflow

### 1. Check Risk Map (morning)

Navigate to the FloodSense dashboard. The risk map shows all 36 Maharashtra
districts colored by their current risk tier (Low/Medium/High/Severe) for
the selected horizon (24/48/72h).

**Action**: Identify any districts with High or Severe tier.

### 2. Review District Details

Click on a flagged district to see:

- **Risk gauge**: Current probability across 24/48/72h horizons
- **Why this risk**: Human-readable drivers (rainfall amounts, upstream
  conditions, percentile rankings)
- **Data confidence**: Whether inputs are measured or interpolated
- **Rainfall outlook**: Observed + forecast precipitation
- **Risk history**: How probability has changed over recent runs

**Decision**: Is this a genuine concern or a data-quality issue?

### 3. Compare with Baseline

The evidence card shows how the GRU prediction compares with a simple
rainfall threshold. If both agree, confidence is higher. If they disagree,
investigate further.

### 4. Test Scenarios (optional)

Use the what-if simulator to test rainfall scenarios:

- "What if it rains 100mm tomorrow?"
- "What if upstream rainfall increases?"

This helps plan resource allocation.

### 5. Historical Replay (for context)

Select a documented historical flood event to see how FloodSense would
have behaved:

- Step through 72 hours before the event
- See risk rising as upstream conditions worsen
- Compare GRU prediction with rainfall threshold
- Estimate warning lead time

### 6. Alert Management

When High/Severe tier is detected:

- System sends WhatsApp alert to subscribed users in that district
- Alert includes: risk level, probability, recommended action, data confidence
- Alert is labeled as "SIMULATED WARNING" — not official

### 7. Escalation Decision

Based on the evidence:

- **Low/Medium**: Continue routine monitoring
- **High**: Increase monitoring frequency, verify local gauges, prepare
- **Severe**: Notify emergency teams, prepare for potential action

## Key Principles

1. **Never act on FloodSense alone** — always verify with official sources
2. **Check data confidence** — low confidence means caution
3. **Use scenario tool** — test "what if" before allocating resources
4. **Review replay** — understand system behavior on historical events
5. **The system supports decisions, it doesn't make them**
