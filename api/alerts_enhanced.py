"""
Enhanced alert system with safety controls.

Implements:
- Consent management
- Alert deduplication
- Cooldown periods
- Audit logging
- Simulation mode
- Stale-data warnings

Usage:
    from api.alerts_enhanced import AlertManager
"""

import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

AUDIT_LOG_PATH = Path(__file__).resolve().parent.parent / "data" / "processed" / "alert_audit.jsonl"
COOLDOWN_HOURS = 6  # minimum hours between alerts for same district
SIMULATION_MODE = os.environ.get("FLOODSENSE_SIMULATION", "false").lower() == "true"


class AlertManager:
    """Manages alert delivery with safety controls."""

    def __init__(self, simulation_mode: bool = False):
        self.simulation_mode = simulation_mode or SIMULATION_MODE
        self._dedup_window = timedelta(hours=COOLDOWN_HOURS)
        self._recent_alerts: dict[str, datetime] = {}  # district -> last alert time

    def check_can_alert(self, district: str, tier: int) -> dict:
        """Check if an alert should be sent for this district."""
        reasons = []

        # Tier check
        if tier < 2:
            reasons.append(f"tier {tier} < 2 (High threshold)")

        # Deduplication / cooldown
        last_alert = self._recent_alerts.get(district)
        if last_alert:
            elapsed = datetime.now(timezone.utc) - last_alert
            if elapsed < self._dedup_window:
                remaining = self._dedup_window - elapsed
                reasons.append(f"cooldown: {remaining.seconds // 3600}h remaining")

        # Simulation mode
        if self.simulation_mode:
            reasons.append("simulation mode — message will be logged, not sent")

        return {
            "can_alert": tier >= 2 and (last_alert is None or
                         (datetime.now(timezone.utc) - last_alert) >= self._dedup_window),
            "reasons": reasons,
            "simulation_mode": self.simulation_mode,
        }

    def record_alert(self, district: str, tier: int, phone: str,
                     status: str, details: dict = None):
        """Record an alert in the audit log."""
        self._recent_alerts[district] = datetime.now(timezone.utc)

        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "district": district,
            "tier": tier,
            "phone": phone[:6] + "****" if len(phone) > 6 else phone,  # mask phone
            "status": status,
            "simulation": self.simulation_mode,
        }
        if details:
            entry["details"] = details

        AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(AUDIT_LOG_PATH, "a") as f:
            f.write(json.dumps(entry) + "\n")

    def build_safe_message(self, district: str, tier: int, p24: float,
                           data_confidence: str = "unknown",
                           source: str = "model") -> str:
        """Build an alert message with safety disclaimers."""
        TIER_NAMES = ["Low", "Medium", "High", "Severe"]
        TIER_ACTIONS = {
            0: "No action needed.",
            1: "Monitor updates; avoid waterlogged routes.",
            2: "Prepare: move vehicles/valuables; avoid riverbanks.",
            3: "EVACUATE low-lying areas now and follow official instructions.",
        }

        msg = (
            f"FLOODSENSE SIMULATED WARNING\n\n"
            f"District: {district}\n"
            f"Risk: {TIER_NAMES[tier]} (24h probability: {p24:.0%})\n"
            f"Horizon: within 24 hours\n"
            f"Data confidence: {data_confidence}\n"
            f"Prediction source: {source}\n\n"
            f"Recommended action: {TIER_ACTIONS[tier]}\n\n"
            f"This is a prototype alert from FloodSense, a decision-support "
            f"tool. It is NOT an official emergency warning. Always follow "
            f"official disaster-management instructions.\n\n"
            f"Updated: {datetime.now(timezone.utc).strftime('%H:%M UTC')}"
        )

        if self.simulation_mode:
            msg = f"[SIMULATION]\n\n{msg}"

        return msg

    def get_audit_log(self, limit: int = 50) -> list[dict]:
        """Read recent audit log entries."""
        if not AUDIT_LOG_PATH.exists():
            return []
        entries = []
        with open(AUDIT_LOG_PATH) as f:
            for line in f:
                line = line.strip()
                if line:
                    entries.append(json.loads(line))
        return entries[-limit:]

    def unsubscribe(self, phone: str, district: str) -> bool:
        """Mark a subscription as inactive."""
        from .db import SessionLocal, Subscription
        from sqlalchemy import select

        with SessionLocal() as db:
            sub = db.scalars(select(Subscription).where(
                Subscription.phone == phone,
                Subscription.district == district)).first()
            if sub:
                sub.active = False
                db.commit()
                self.record_alert(district, 0, phone, "unsubscribed")
                return True
        return False
