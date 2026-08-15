import { FormEvent, useState } from "react";
import { subscribe } from "../api";
import { Card } from "./States";

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

  const inputCls = `w-full rounded-lg border bg-surface px-3 py-2 text-sm
                    placeholder:text-fg-subtle text-fg
                    focus:outline-none focus:ring-2 focus:ring-accent/50
                    focus:border-accent/50 transition`;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tier-low/10 text-tier-low">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 8.24 8.25c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.8-.23-.09-.4-.13-.56.12-.17.25-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.73-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.13.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.6.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
          </svg>
        </div>
        <div>
          <h2 className="text-[13px] font-bold tracking-tight">WhatsApp alerts</h2>
          <p className="text-[11px] leading-tight text-fg-muted">
            Notified when your district crosses into High
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-3.5 grid gap-2">
        <div>
          <label htmlFor="fs-phone" className="sr-only">Phone number</label>
          <input
            id="fs-phone"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setStatus({ kind: "idle" }); }}
            placeholder="+919812345678"
            inputMode="tel"
            autoComplete="tel"
            className={`${inputCls} border-line num`}
          />
        </div>
        <div>
          <label htmlFor="fs-district" className="sr-only">District</label>
          <select
            id="fs-district"
            value={district}
            onChange={(e) => { setDistrict(e.target.value); setStatus({ kind: "idle" }); }}
            required
            className={`${inputCls} border-line ${district ? "" : "text-fg-subtle"}`}
          >
            <option value="" disabled>Select district…</option>
            {districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <button
          type="submit"
          disabled={busy || !district}
          className="mt-0.5 inline-flex items-center justify-center gap-2 rounded-lg
                     bg-accent px-3 py-2 text-sm font-semibold text-accent-fg
                     hover:opacity-90 active:opacity-80
                     disabled:cursor-not-allowed disabled:opacity-45
                     focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-accent/60 focus-visible:ring-offset-2
                     focus-visible:ring-offset-bg transition"
        >
          {busy && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5"
                      strokeLinecap="round" strokeDasharray="42 14" />
            </svg>
          )}
          {busy ? "Subscribing…" : "Subscribe"}
        </button>
      </form>

      {status.kind === "ok" && (
        <div className="anim-in mt-2.5 flex items-start gap-2 rounded-lg border border-tier-low/25
                        bg-tier-low/10 px-3 py-2 text-xs leading-relaxed text-tier-low">
          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span>
            Subscribed to <strong>{district}</strong> alerts. New numbers: send the
            sandbox join code to <span className="num">+1 415 523 8886</span> on
            WhatsApp once to activate.
          </span>
        </div>
      )}
      {status.kind === "err" && (
        <div className="anim-in mt-2.5 flex items-start gap-2 rounded-lg border border-tier-severe/25
                        bg-tier-severe/10 px-3 py-2 text-xs leading-relaxed text-tier-severe">
          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 8v5m0 3.5v.5M10.3 3.9 2.5 18a1.8 1.8 0 0 0 1.6 2.7h15.8a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
          </svg>
          <span>{status.msg}</span>
        </div>
      )}
    </Card>
  );
}
