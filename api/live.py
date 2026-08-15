"""Scheduled live-data job: Open-Meteo → inference → risk_state → alerts.

Runs on APScheduler inside the API process (free-tier hosts don't offer
cron) every REFRESH_HOURS, and can be triggered manually via
POST /api/cron/run — that manual trigger is also the demo hook.
"""

import os

from sqlalchemy import select

from .alerts import TIER_NAMES, build_alert_message, send_whatsapp
from .db import RiskState, SessionLocal, Subscription
from .inference import predict_all

REFRESH_HOURS = int(os.environ.get("REFRESH_HOURS", "3"))
ALERT_TIER = 2   # High or Severe triggers WhatsApp


def run_cycle() -> dict:
    """One full refresh. Returns a summary for logging / the demo."""
    preds = predict_all()
    alerts_sent, updates = [], []

    with SessionLocal() as db:
        # latest row per station (history is kept for charts)
        latest = {}
        for r in db.scalars(select(RiskState).order_by(RiskState.updated_at)):
            latest[r.station_id] = r

        for sid, e in preds.items():
            row = latest.get(sid)
            escalated = row is None or row.tier24 < ALERT_TIER
            crosses = e["tier24"] >= ALERT_TIER and escalated
            updates.append({"station_id": sid, "district": e["district"],
                            "tier": e["tier24"], "alert_fired": crosses})
            if crosses:
                msg = build_alert_message(e["district"], e["tier24"], e["p24"])
                subs = db.scalars(select(Subscription).where(
                    Subscription.district == e["district"],
                    Subscription.active.is_(True))).all()
                for s in subs:
                    res = send_whatsapp(s.phone, msg)
                    alerts_sent.append({"phone": s.phone,
                                        "district": e["district"], **res})
            db.add(RiskState(
                station_id=sid, district=e["district"], as_of=e["as_of"],
                p24=e["p24"], p48=e["p48"], p72=e["p72"],
                tier24=e["tier24"], tier48=e["tier48"], tier72=e["tier72"],
                source=e.get("source", "model"),
            ))
        db.commit()

    summary = {"stations_updated": len(updates),
               "alerts_sent": len(alerts_sent),
               "updates": updates, "alerts": alerts_sent}
    print(f"[live-cycle] {summary['stations_updated']} stations, "
          f"{summary['alerts_sent']} alerts")
    return summary
