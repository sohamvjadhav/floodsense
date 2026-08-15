"""WhatsApp alerts via Twilio sandbox, over plain REST (no SDK dependency).

Falls back to logging the message when TWILIO_ACCOUNT_SID/AUTH_TOKEN are
unset, so the pipeline (and the viva demo) never crashes on missing
credentials — the alert payload is always visible in server logs.
"""

import os

import httpx

TWILIO_API = "https://api.twilio.com/2010-04-01/Accounts"
SANDBOX_NUMBER = "whatsapp:+14155238886"   # Twilio sandbox sender

TIER_NAMES = ["Low", "Medium", "High", "Severe"]
TIER_ACTIONS = {
    0: "No action needed.",
    1: "Monitor updates; avoid waterlogged routes.",
    2: "Prepare: move vehicles/valuables; avoid riverbanks.",
    3: "EVACUATE low-lying areas now and follow official instructions.",
}


def build_alert_message(district: str, tier: int, p24: float) -> str:
    return (f"FloodSense ALERT — {district} district\n"
            f"Risk: {TIER_NAMES[tier].upper()} (24h flood risk {p24:.0%})\n"
            f"What to do: {TIER_ACTIONS[tier]}")


def send_whatsapp(to_phone: str, message: str) -> dict:
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    if not sid or not token:
        print(f"[twilio:not-configured] would send to {to_phone}:\n{message}")
        return {"status": "logged_only"}
    resp = httpx.post(
        f"{TWILIO_API}/{sid}/Messages.json",
        data={"From": SANDBOX_NUMBER, "To": f"whatsapp:{to_phone}", "Body": message},
        auth=(sid, token),
        timeout=30,
    )
    ok = resp.status_code in (200, 201)
    if not ok:
        print(f"[twilio:error] {resp.status_code} {resp.text}")
    return {"status": "sent" if ok else "error", "code": resp.status_code}
