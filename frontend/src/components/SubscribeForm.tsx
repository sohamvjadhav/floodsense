import { FormEvent, useState } from "react";
import { subscribe } from "../api";

type Status = { kind: "idle" } | { kind: "ok" } | { kind: "err"; msg: string };

export default function SubscribeForm({ districts }: { districts: string[] }) {
  const [phone, setPhone] = useState("+91");
  const [district, setDistrict] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await subscribe(phone.trim(), district);
      setStatus({ kind: "ok" });
    } catch (err) {
      setStatus({ kind: "err", msg: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel anim-in">
      <div className="panel-head">
        <div>
          <h3>WhatsApp alerts</h3>
          <p className="panel-sub">Notified when your district crosses into High</p>
        </div>
        <span className="band band-low">opt-in</span>
      </div>

      <form onSubmit={submit} className="grid gap-2">
        <div className="composer-field">
          <input
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setStatus({ kind: "idle" }); }}
            placeholder="+919812345678"
            inputMode="tel"
            autoComplete="tel"
            aria-label="Phone number"
            className="mono"
          />
        </div>
        <div className="composer-field">
          <select
            value={district}
            onChange={(e) => { setDistrict(e.target.value); setStatus({ kind: "idle" }); }}
            required
            aria-label="District"
          >
            <option value="" disabled>Select district…</option>
            {districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <button type="submit" disabled={busy || !district}
                className="btn btn-primary justify-center">
          {busy ? "Subscribing…" : "Subscribe"}
        </button>
      </form>

      {status.kind === "ok" && (
        <p className="explain-text !mt-3 anim-in">
          <strong>Subscribed to {district}.</strong> New numbers: send the sandbox
          join code to <span className="mono">+1 415 523 8886</span> on WhatsApp
          once to activate delivery.
        </p>
      )}
      {status.kind === "err" && (
        <p className="explain-text !mt-3 anim-in" style={{ color: "var(--tier-severe-500)" }}>
          {status.msg}
        </p>
      )}
    </div>
  );
}
