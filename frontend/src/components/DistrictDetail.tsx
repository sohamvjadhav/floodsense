import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine,
  ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from "recharts";
import type { DistrictDetail as Detail } from "../api";
import { fetchDistrict } from "../api";
import { tierHex, useChartTheme, useTheme, pct } from "../theme";

const TIER_LABEL = ["Low", "Medium", "High", "Severe"];
const BAND = ["band-low", "band-medium", "band-high", "band-severe"];
const TIER_GUIDANCE = [
  "No action needed — conditions are within normal range.",
  "Monitor updates; avoid waterlogged routes and riverbank walks.",
  "Prepare: move vehicles and valuables to higher ground; stay clear of rivers.",
  "EVACUATE low-lying areas now and follow official instructions.",
];

const inr = new Intl.NumberFormat("en-IN", { notation: "compact", compactDisplay: "short" });

/** Semicircle risk gauge, Mule-Hunt style. */
function RiskGauge({ p, color }: { p: number; color: string }) {
  const r = 44, cx = 60, cy = 54;
  const a = Math.PI * (1 - Math.min(1, Math.max(0, p)));
  const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
  return (
    <div className="gauge">
      <svg viewBox="0 0 120 68" width="120" height="68" aria-hidden>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
              fill="none" stroke="var(--surface-3)" strokeWidth="9" strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x} ${y}`}
              fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />
        <circle cx={x} cy={y} r="4.5" fill={color} stroke="var(--surface)" strokeWidth="2" />
      </svg>
      <p className="gauge-label mono">{pct(p, 0)}</p>
    </div>
  );
}

export default function DistrictDetail({
  district, onClose, population,
}: {
  district: string;
  onClose: () => void;
  population?: number;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { theme } = useTheme();
  const hex = tierHex(theme === "dark");
  const { axis, grid, tooltipBg, tooltipBorder, tooltipFg } = useChartTheme();

  useEffect(() => {
    setData(null);
    setErr(null);
    let live = true;
    fetchDistrict(district)
      .then((d) => live && setData(d))
      .catch((e) => live && setErr(String(e)));
    return () => { live = false; };
  }, [district]);

  if (err) {
    return (
      <div className="panel anim-in">
        <div className="panel-head"><h3>Couldn't load district</h3></div>
        <p className="explain-text">{err}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="panel anim-in">
        <div className="skeleton" style={{ width: "38%", height: 22 }} />
        <div className="skeleton" style={{ width: "60%", height: 12, marginTop: 10 }} />
        <div className="skeleton" style={{ height: 180, marginTop: 18, borderRadius: "var(--r-md)" }} />
        <div className="skeleton" style={{ height: 140, marginTop: 12, borderRadius: "var(--r-md)" }} />
      </div>
    );
  }

  const t = data.risk;
  const tooltipStyle = {
    background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 10,
    color: tooltipFg, fontSize: 12, fontFamily: "JetBrains Mono, monospace",
  };

  return (
    <div className="panel anim-in">
      <div className="case-header">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="case-id truncate">{data.district}</h2>
            <button onClick={onClose} aria-label="Close case file"
                    className="icon-btn ml-auto shrink-0">×</button>
          </div>
          <div className="case-tags">
            <span className="chip">{data.basin} basin</span>
            <span className={`band ${BAND[t.tier24]}`}>{TIER_LABEL[t.tier24]}</span>
            <span className="chip mono">as of {data.as_of}</span>
          </div>
        </div>
        <RiskGauge p={t.p24} color={hex[t.tier24]} />
      </div>

      <div className="explain-text mt-4">
        <strong>What to do: </strong>{TIER_GUIDANCE[t.tier24]}
      </div>

      <div className="kv">
        <div className="kv-row"><span className="k">risk +24h</span>
          <span className="v" style={{ color: hex[t.tier24] }}>{pct(t.p24)}</span></div>
        <div className="kv-row"><span className="k">risk +48h</span>
          <span className="v" style={{ color: hex[t.tier48] }}>{pct(t.p48)}</span></div>
        <div className="kv-row"><span className="k">risk +72h</span>
          <span className="v" style={{ color: hex[t.tier72] }}>{pct(t.p72)}</span></div>
        <div className="kv-row"><span className="k">population</span>
          <span className="v">{population != null ? inr.format(population) : "—"}</span></div>
        <div className="kv-row"><span className="k">station</span>
          <span className="v">{data.station_id}</span></div>
        <div className="kv-row"><span className="k">updates</span>
          <span className="v">{data.risk_history.length}</span></div>
      </div>

      <h4 className="section-h">Risk probability by lead time</h4>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data.probability_curve} margin={{ top: 10, right: 4, left: -14, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis dataKey="horizon_h" tickFormatter={(h) => `+${h}h`}
                 tick={{ fill: axis, fontSize: 11, fontFamily: "JetBrains Mono" }}
                 axisLine={{ stroke: grid }} tickLine={false} />
          <YAxis tickFormatter={(p) => `${Math.round(p * 100)}%`}
                 tick={{ fill: axis, fontSize: 11, fontFamily: "JetBrains Mono" }}
                 axisLine={false} tickLine={false} />
          <ChartTooltip contentStyle={tooltipStyle} cursor={{ fill: grid, opacity: .4 }}
                        formatter={(v: number) => [pct(v), "risk"]} labelFormatter={(h) => `${h} ahead`} />
          <Bar dataKey="p" radius={[5, 5, 0, 0]} maxBarSize={44}>
            {data.probability_curve.map((c) => (
              <Cell key={c.horizon_h} fill={hex[c.tier]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <h4 className="section-h">Rainfall — observed & outlook</h4>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data.rainfall_recent} margin={{ top: 10, right: 4, left: -14, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)}
                 tick={{ fill: axis, fontSize: 10, fontFamily: "JetBrains Mono" }}
                 axisLine={{ stroke: grid }} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: axis, fontSize: 11, fontFamily: "JetBrains Mono" }}
                 axisLine={false} tickLine={false} width={44} />
          <ChartTooltip contentStyle={tooltipStyle} cursor={{ fill: grid, opacity: .4 }}
                        formatter={(v: number) => [`${v} mm`, "rainfall"]}
                        labelFormatter={(d) => `day ${d.slice(5)}`} />
          <ReferenceLine x={data.as_of} stroke={axis} strokeDasharray="4 2" />
          <Bar dataKey="rainfall_mm" radius={[3, 3, 0, 0]}>
            {data.rainfall_recent.map((r) => (
              <Cell key={r.date} fill={r.forecast ? "#8B7CF6" : "#3FA9F5"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1.5 flex items-center gap-4 text-[11px] text-fg-subtle">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-[3px]" style={{ background: "#3FA9F5" }} />
          observed (model input)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-[3px]" style={{ background: "#8B7CF6" }} />
          forecast (outlook only)
        </span>
      </div>

      {data.risk_history.length > 2 && (
        <>
          <h4 className="section-h">24h-risk trend, recent refreshes</h4>
          <ResponsiveContainer width="100%" height={70}>
            <AreaChart data={data.risk_history} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
              <ChartTooltip contentStyle={tooltipStyle}
                            formatter={(v: number) => [pct(v), "24h risk"]} labelFormatter={() => ""} />
              <Area type="monotone" dataKey="p24" stroke="#3FD4BC"
                    fill="rgba(63,212,188,0.12)" strokeWidth={2} dot={false}
                    isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
