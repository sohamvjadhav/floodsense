"""FloodSense API — single FastAPI service (public API + inference).

Endpoints (spec):
    GET  /api/risk/map            all districts, current tier + probabilities
    GET  /api/risk/{district}     detail: tier, 24/48/72h curve, recent rainfall
    POST /api/alerts/subscribe    {phone, district} → WhatsApp subscription
    GET  /api/stations/{id}/history  recent readings for detail charts
    POST /api/cron/run            manual live-cycle trigger (demo hook)
"""

from contextlib import asynccontextmanager
from math import isnan

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from sqlalchemy import select, func

from .alerts import TIER_NAMES
from .db import RiskState, SessionLocal, Subscription
from .inference import fetch_live_daily
from .live import REFRESH_HOURS, run_cycle
from src.data.stations import STATIONS, STATION_BY_ID

TIER_COLORS = ["#22c55e", "#eab308", "#f97316", "#dc2626"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    scheduler.add_job(run_cycle, "interval", hours=REFRESH_HOURS)
    scheduler.start()
    with SessionLocal() as db:   # seed on cold start so the map is never empty
        if db.scalar(select(func.count()).select_from(RiskState)) == 0:
            run_cycle()
    yield
    scheduler.shutdown()


app = FastAPI(title="FloodSense API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # locked down via env in prod (pages.dev domain)
    allow_methods=["*"], allow_headers=["*"],
)


class SubscribeIn(BaseModel):
    phone: str
    district: str

    @field_validator("phone")
    @classmethod
    def e164(cls, v: str) -> str:
        v = v.replace(" ", "")
        if not (v.startswith("+91") and len(v) == 13 and v[1:].isdigit()):
            raise ValueError("phone must be Indian E.164, e.g. +919812345678")
        return v

    @field_validator("district")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in {s["district"] for s in STATIONS}:
            raise ValueError(f"unknown district: {v}")
        return v


def _latest_state(db) -> dict:
    latest = {}
    for r in db.scalars(select(RiskState).order_by(RiskState.updated_at)):
        latest[r.station_id] = r
    return latest


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/risk/map")
def risk_map():
    with SessionLocal() as db:
        state = _latest_state(db)
    out = []
    for s in STATIONS:
        r = state.get(s["station_id"])
        out.append({
            "station_id": s["station_id"], "district": s["district"],
            "basin": s["basin"], "lat": s["lat"], "lon": s["lon"],
            "tier": r.tier24 if r else 0,
            "tier_name": TIER_NAMES[r.tier24] if r else "Low",
            "color": TIER_COLORS[r.tier24] if r else TIER_COLORS[0],
            "p24": r.p24 if r else 0.0, "p48": r.p48 if r else 0.0,
            "p72": r.p72 if r else 0.0,
            "as_of": r.as_of if r else None,
        })
    return {"districts": out, "legend": list(zip(TIER_NAMES, TIER_COLORS))}


@app.get("/api/risk/{district}")
def risk_district(district: str):
    station = next((s for s in STATIONS if s["district"].lower() == district.lower()), None)
    if not station:
        raise HTTPException(404, f"unknown district: {district}")
    with SessionLocal() as db:
        rows = db.scalars(select(RiskState)
                          .where(RiskState.station_id == station["station_id"])
                          .order_by(RiskState.updated_at)).all()
    if not rows:
        raise HTTPException(503, "no inference yet — POST /api/cron/run first")
    latest = rows[-1]
    history = [{"updated_at": r.updated_at.isoformat(), "p24": r.p24,
                "p48": r.p48, "p72": r.p72} for r in rows[-20:]]
    outlook = fetch_live_daily(past_days=7, forecast_days=4)
    g = outlook[outlook["station_id"] == station["station_id"]]
    rain = [{"date": str(d.date()), "rainfall_mm": (0.0 if isnan(v) else round(v, 1)),
             "forecast": str(d.date()) > latest.as_of}
            for d, v in zip(g["date"], g["rainfall_mm"])]
    return {
        "district": station["district"], "station_id": station["station_id"],
        "basin": station["basin"],
        "as_of": latest.as_of,
        "risk": {"p24": latest.p24, "p48": latest.p48, "p72": latest.p72,
                 "tier24": latest.tier24, "tier48": latest.tier48,
                 "tier72": latest.tier72,
                 "tier_name": TIER_NAMES[latest.tier24]},
        "probability_curve": [
            {"horizon_h": 24, "p": latest.p24, "tier": latest.tier24,
             "tier_name": TIER_NAMES[latest.tier24]},
            {"horizon_h": 48, "p": latest.p48, "tier": latest.tier48,
             "tier_name": TIER_NAMES[latest.tier48]},
            {"horizon_h": 72, "p": latest.p72, "tier": latest.tier72,
             "tier_name": TIER_NAMES[latest.tier72]},
        ],
        "rainfall_recent": rain,
        "risk_history": history,
    }


from math import isnan as pd_isna  # small helper, keep import local


@app.post("/api/alerts/subscribe")
def subscribe(body: SubscribeIn):
    with SessionLocal() as db:
        exists = db.scalars(select(Subscription).where(
            Subscription.phone == body.phone,
            Subscription.district == body.district)).first()
        if exists:
            exists.active = True
        else:
            db.add(Subscription(phone=body.phone, district=body.district))
        db.commit()
    return {"ok": True, "phone": body.phone, "district": body.district,
            "channel": "whatsapp"}


@app.get("/api/stations/{station_id}/history")
def station_history(station_id: str, days: int = 14):
    if station_id not in STATION_BY_ID:
        raise HTTPException(404, f"unknown station: {station_id}")
    df = fetch_live_daily(past_days=min(days, 14), forecast_days=0)
    g = df[df["station_id"] == station_id].sort_values("date")
    return {
        "station_id": station_id,
        "district": STATION_BY_ID[station_id]["district"],
        "readings": [
            {"date": str(d.date()),
             "rainfall_mm": None if isnan(v) else round(float(v), 1),
             "rain_7d_mm": round(float(r7), 1)}
            for d, v, r7 in zip(g["date"], g["rainfall_mm"], g["rain_7d_mm"])
        ],
    }


@app.post("/api/cron/run")
def cron_run():
    return run_cycle()
