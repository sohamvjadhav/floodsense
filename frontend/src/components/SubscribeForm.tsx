import { FormEvent, useState } from "react";
import { subscribe } from "../api";

export default function SubscribeForm({ districts }: { districts: string[] }) {
  const [phone, setPhone] = useState("+91");
  const [district, setDistrict] = useState("");
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "ok" } | { kind: "err"; msg: string }
  >({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await subscribe(phone.trim(), district);
      setStatus({ kind: "ok" });
    } catch (err) {
      setStatus({ kind: "err", msg: String((err as Error).message) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="text-sm font-bold">WhatsApp alerts</h2>
      <p className="mt-1 text-xs text-slate-400">
        Get a message when your district's risk crosses into High.
      </p>
      <div className="mt-3 grid gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+919812345678"
          inputMode="tel"
          className="rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm
                     focus:outline-none focus:border-sky-500"
        />
        <select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          required
          className="rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm
                     focus:outline-none focus:border-sky-500"
        >
          <option value="" disabled>Select district…</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <button
          type="submit"
          disabled={busy || !district}
          className="rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                     px-3 py-2 text-sm font-semibold transition-colors"
        >
          {busy ? "Subscribing…" : "Subscribe"}
        </button>
      </div>
      {status.kind === "ok" && (
        <p className="mt-2 text-xs text-emerald-300">
          Subscribed — you'll be alerted for {district}. (Join the Twilio
          sandbox once by sending the join code to +1 415 523 8886 on WhatsApp.)
        </p>
      )}
      {status.kind === "err" && (
        <p className="mt-2 text-xs text-red-300">{status.msg}</p>
      )}
    </form>
  );
}
