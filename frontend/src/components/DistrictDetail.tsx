import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine,
  ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from "recharts";
import type { DistrictDetail as Detail } from "../api";
import { fetchDistrict } from "../api";
import { TIER_STYLES, pct, useChartTheme } from "../theme";
import { Card, DetailSkeleton, ErrorState } from "./States";

const TIER_HEX = ["#059669", "#b45309", "#ea580c", "#dc2626"];
const TIER_HEX_DARK = ["#34d399", "#fbbf24", "#fb923c", "#f87171"];
const TIER_GUIDANCE = [
  "No action needed — conditions are within normal range.",
  "Monitor updates; avoid waterlogged routes and riverbank walks.",
  "Prepare: move vehicles and valuables to higher ground; stay clear of rivers.",
  "EVACUATE low-lying areas now and follow official instructions.",
];

export default function DistrictDetail({
  district, onClose,
}: {
  district: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { dark, axis, grid, tooltipBg, tooltipBorder, tooltipFg } = useChartTheme();
  const tierHexArr = dark ? TIER_HEX_DARK : TIER_HEX;

  useEffect(() => {
    setData(null);
    setErr(null);
    let live = true;
    fetchDistrict(district)
      .then((d) => live && setData(d))
      .catch((e) => live && setErr(String(e)));
    return () => { live = false; };
  }, [district]);

  if (err) return <ErrorState message="Couldn't load district details" hint={err} />;
  if (!data) return <DetailSkeleton />;

  const s = TIER_STYLES[data.risk.tier24];
  const guidance = TIER_GUIDANCE[data.risk.tier24];
  const tooltipStyle = {
    background: tooltipBg,
    border: `1px solid ${tooltipBorder}`,
    borderRadius: 10,
    color: tooltipFg,
    fontSize: 12,
    boxShadow: dark ? "0 8px 24px rgba(0,0,0,.5)" : "0 8px 24px rgba(16,24,40,.12)",
  };

  return (
    <Card className="anim-in overflow-hidden">
      <div className={`border-b border-line px-5 py-4 ${s.soft}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold tracking-tight">{data.district}</h2>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-fg-muted">
              {data.basin} basin · as of {data.as_of}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close details"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-fg-subtle
                       hover:bg-surface hover:text-fg
                       focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-accent/60 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2.5">
          <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${s.soft} ${s.fg}`}>
            {data.risk.tier_name.toUpperCase()}
          </span>
          <span className="num text-xs text-fg-muted">
            24h risk <span className="font-semibold text-fg">{pct(data.risk.p24)}</span>
          </span>
        </div>
      </div>

      <div className="px-5 py-4">
        <p className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${s.soft} ${s.fg}`}>
          <span className="font-semibold">What to do: </span>{guidance}
        </p>

        <h3 className="mt-5 text-[11px] font-bold uppercase tracking-wider text-fg-subtle">
          Risk probability by lead time
        </h3>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={data.probability_curve} margin={{ top: 12, right: 4, left: -14, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="horizon_h" tickFormatter={(h) => `+${h}h`}
                   tick={{ fill: axis, fontSize: 11 }} axisLine={{ stroke: grid }}
                   tickLine={false} />
            <YAxis tickFormatter={(p) => `${Math.round(p * 100)}%`}
                   tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
            <ChartTooltip contentStyle={tooltipStyle} cursor={{ fill: grid, opacity: 0.4 }}
                          formatter={(v: number) => [pct(v), "risk"]} labelFormatter={(h) => `${h} ahead`} />
            <Bar dataKey="p" radius={[5, 5, 0, 0]} maxBarSize={44}>
              {data.probability_curve.map((c) => (
                <Cell key={c.horizon_h} fill={tierHexArr[c.tier]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <h3 className="mt-5 text-[11px] font-bold uppercase tracking-wider text-fg-subtle">
          Rainfall — observed & outlook
        </h3>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={data.rainfall_recent} margin={{ top: 12, right: 4, left: -14, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)}
                   tick={{ fill: axis, fontSize: 10 }} axisLine={{ stroke: grid }}
                   tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false}
                   unit="mm" width={44} />
            <ChartTooltip contentStyle={tooltipStyle} cursor={{ fill: grid, opacity: 0.4 }}
                          formatter={(v: number) => [`${v} mm`, "rainfall"]}
                          labelFormatter={(d) => `day ${d.slice(5)}`} />
            <ReferenceLine x={data.as_of} stroke={axis} strokeDasharray="4 2" />
            <Bar dataKey="rainfall_mm" radius={[3, 3, 0, 0]}>
              {data.rainfall_recent.map((r) => (
                <Cell key={r.date} fill={r.forecast ? (dark ? "#818cf8" : "#6366f1") : (dark ? "#38bdf8" : "#0284c7")} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex items-center gap-4 text-[11px] text-fg-subtle">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-[3px]" style={{ background: dark ? "#38bdf8" : "#0284c7" }} />
            observed (model input)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-[3px]" style={{ background: dark ? "#818cf8" : "#6366f1" }} />
            forecast (outlook only)
          </span>
        </div>

        {data.risk_history.length > 2 && (
          <>
            <h3 className="mt-5 text-[11px] font-bold uppercase tracking-wider text-fg-subtle">
              24h-risk trend, recent refreshes
            </h3>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={data.risk_history} margin={{ top: 6, right: 4, left: -14, bottom: 0 }}>
                <ChartTooltip contentStyle={tooltipStyle}
                              formatter={(v: number) => [pct(v), "24h risk"]} labelFormatter={() => ""} />
                <Area type="monotone" dataKey="p24" stroke={dark ? "#38bdf8" : "#0e7490"}
                      fill={dark ? "#38bdf822" : "#0e749018"} strokeWidth={2}
                      dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </Card>
  );
}
