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
# Experimental rainfall-risk guidance — NOT flood forecasts, NOT
# inundation warnings, NOT evacuation orders. Severe tier advises
# contacting official authorities; the system never orders evacuation.
TIER_ACTIONS = {
    0: "No action needed. Experimental rainfall-risk guidance only.",
    1: "Monitor updates; avoid waterlogged routes. Verify with official sources.",
    2: "Prepare: move vehicles/valuables; avoid riverbanks. Verify with official sources.",
    3: "High rainfall-risk (experimental). Contact local authorities and follow OFFICIAL instructions. Verify before acting.",
}
TIER_ACTIONS_MR = {
    0: "सध्या कारवाईची गरज नाही. केवळ प्रायोगिक पर्जन्य-जोखीम मार्गदर्शन.",
    1: "अद्यतने पाहत राहा; पाणी साचलेले रस्ते टाळा. अधिकृत सूचनांची खात्री करा.",
    2: "तयारी ठेवा: वाहने/मौल्यवान वस्तू हलवा; नदीकाठ टाळा. अधिकृत सूचनांची खात्री करा.",
    3: "जास्त पर्जन्य-जोखीम (प्रायोगिक). स्थानिक प्रशासनाशी संपर्क साधा आणि केवळ अधिकृत सूचनांचे पालन करा. कृतीपूर्वी खात्री करा.",
}

EXPERIMENTAL_PREFIX = "FloodSense EXPERIMENTAL rain-risk"
EXPERIMENTAL_PREFIX_MR = "फ्लडसेन्स प्रायोगिक पर्जन्य-जोखीम"


def build_alert_message(district: str, tier: int, p24: float, lang: str = "en") -> str:
    """Bilingual experimental guidance message (en | mr)."""
    if lang == "mr":
        return (f"{EXPERIMENTAL_PREFIX_MR} — {district} जिल्हा\n"
                f"जोखीम: {TIER_NAMES[tier].upper()} (२४ तास पर्जन्य-जोखीम {p24:.0%})\n"
                f"काय करावे: {TIER_ACTIONS_MR[tier]}\n"
                f"ही अधिकृत सूचना नाही.")
    return (f"{EXPERIMENTAL_PREFIX} — {district} district\n"
            f"Risk: {TIER_NAMES[tier].upper()} (24h rainfall-risk {p24:.0%})\n"
            f"What to do: {TIER_ACTIONS[tier]}\n"
            f"Not an official warning.")


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
