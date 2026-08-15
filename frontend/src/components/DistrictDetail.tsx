import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer,
  Tooltip as ChartTooltip, XAxis, YAxis,
} from "recharts";
import { DistrictDetail as Detail, fetchDistrict } from "../api";

const TIER_COLOR = ["#22c55e", "#eab308", "#f97316", "#dc2626"];

export default function DistrictDetail({
  district, onClose,
}: {
  district: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setData(null); setErr(null);
    fetchDistrict(district).then(setData).catch((e) => setErr(String(e)));
  }, [district]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 overflow-y-auto max-h-[70vh]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">{district}</h2>
          {data && (
            <p className="text-xs text-slate-400">
              {data.basin} basin · window as of {data.as_of}
            </p>
          )}
        </div>
        <button onClick={onClose}
                className="text-slate-400 hover:text-slate-200 text-lg leading-none px-1">×</button>
      </div>

      {err && <p className="mt-4 text-sm text-red-300">{err}</p>}
      {!data && !err && <p className="mt-4 text-sm text-slate-400">Loading…</p>}

      {data && (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="rounded-md px-2.5 py-1 text-sm font-semibold text-slate-950"
                  style={{ background: TIER_COLOR[data.risk.tier24] }}>
              {data.risk.tier_name}
            </span>
            <span className="text-xs text-slate-400">
              24h flood risk {(data.risk.p24 * 100).toFixed(1)}%
            </span>
          </div>

          <h3 className="mt-5 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Risk probability by lead time
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.probability_curve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="horizon_h"
                     tickFormatter={(h) => `${h}h`}
                     tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tickFormatter={(p) => `${(p * 100).toFixed(0)}%`}
                     tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <ChartTooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
              <Bar dataKey="p" radius={[4, 4, 0, 0]}>
                {data.probability_curve.map((c) => (
                  <Cell key={c.horizon_h} fill={TIER_COLOR[c.tier]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <h3 className="mt-5 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Rainfall — observed & forecast (mm/day)
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data.rainfall_recent}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date"
                     tickFormatter={(d) => d.slice(5)}
                     tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <ChartTooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="rainfall_mm" name="rainfall (mm)" radius={[3, 3, 0, 0]}>
                {data.rainfall_recent.map((r) => (
                  <Cell key={r.date} fill={r.forecast ? "#6366f1" : "#38bdf8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[11px] text-slate-500">
            Blue = observed (model input) · Indigo = forecast (outlook only, not model input)
          </p>
        </>
      )}
    </div>
  );
}
