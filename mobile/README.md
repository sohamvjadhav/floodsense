# FloodSense Mobile (Android)

Expo / React Native client for the FloodSense API. All model inference stays
server-side — the app is a pure API consumer.

## Screens

| Tab | Purpose |
|-----|---------|
| **Map** | District risk circles on Google Maps, +24/48/72h switcher, tap → case file |
| **Districts** | Ranked risk queue with KPI row (districts, High+ count, exposed population) |
| **Replay** | Historical event replay: operator briefing card, day-by-day decision timeline, lead-time verdict banner |
| **Alerts** | WhatsApp opt-in / opt-out by district |

Tapping any district opens its **case file**: risk gauge, tier guidance,
24/48/72h probability bars, why-this-risk drivers, and a scenario lab
(preset rainfall chips + slider → live tier-transition deltas).

## Run on your phone (2 min)

1. Start the backend so the phone can reach it:

   ```bash
   cd .. && .venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8000
   ```

2. Find your machine's LAN IP (`ipconfig getifaddr en0`) and point the app at it:

   ```bash
   cd mobile
   cp .env.example .env     # edit EXPO_PUBLIC_API_URL=http://<LAN-IP>:8000
   npx expo start
   ```

3. Install **Expo Go** from the Play Store, then scan the QR code in the terminal.
   Phone and laptop must be on the same Wi-Fi.

> Android emulator needs no `.env` — it defaults to `http://10.0.2.2:8000`.

## Build an installable APK (for the viva)

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

Produces a standalone APK you can sideload — no Expo Go needed at demo time.

## Structure

```
mobile/
├── App.tsx                  # navigation shell (tabs + district stack)
├── app.json                 # Expo config (package id, dark UI)
├── eas.json                 # APK build profile
└── src/
    ├── config.ts            # API URL from EXPO_PUBLIC_API_URL
    ├── api/
    │   ├── types.ts         # shared response types
    │   ├── client.ts        # fetch helpers
    │   └── endpoints.ts     # map / detail / replay / scenario / alerts
    ├── theme/index.ts       # colors, tiers, nav theme
    ├── hooks/useRiskMap.ts  # map data + health polling
    ├── components/          # TierBadge, RiskGauge, ProbBars, DistrictRow
    └── screens/             # Map, List, District, Replay, Alerts
```
