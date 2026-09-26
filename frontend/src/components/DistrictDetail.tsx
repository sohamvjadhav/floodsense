import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine,
  ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from "recharts";
import type { DistrictDetail as Detail, EvidenceResult } from "../api";
import { fetchDistrict, fetchEvidence, runScenario, type ScenarioResult } from "../api";
import { tierHex, useChartTheme, useTheme, pct } from "../theme";

const TIER_LABEL = ["Low", "Medium", "High", "Severe"];
const BAND = ["band-low", "band-medium", "band-high", "band-severe"];
const TIER_GUIDANCE = [
  "No action needed — conditions are within normal range. Experimental guidance only.",
  "Monitor updates; avoid waterlogged routes. Verify with official sources.",
  "Prepare: move vehicles and valuables to higher ground; stay clear of rivers. Verify with official sources.",
  "High rainfall-risk (experimental). Contact local authorities and follow ONLY official instructions.",
];
const TIER_GUIDANCE_MR = [
  "सध्या कारवाईची गरज नाही. केवळ प्रायोगिक मार्गदर्शन.",
  "अद्यतने पाहत राहा; पाणी साचलेले रस्ते टाळा. अधिकृत सूचनांची खात्री करा.",
  "तयारी ठेवा: वाहने/मौल्यवान वस्तू हलवा; नदीकाठ टाळा. अधिकृत सूचनांची खात्री करा.",
  "जास्त पर्जन्य-जोखीम (प्रायोगिक). स्थानिक प्रशासनाशी संपर्क साधा; केवळ अधिकृत सूचनांचे पालन करा.",
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
  const [whatIf, setWhatIf] = useState(100);
  const [scenario, setScenario] = useState<ScenarioResult | null>(null);
  const [scBusy, setScBusy] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceResult | null>(null);
  const { theme } = useTheme();
  const hex = tierHex(theme === "dark");
  const { axis, grid, tooltipBg, tooltipBorder, tooltipFg } = useChartTheme();

  useEffect(() => {
    setData(null);
    setErr(null);
    setScenario(null);
    setEvidence(null);
    let live = true;
    fetchDistrict(district)
      .then((d) => live && setData(d))
      .catch((e) => live && setErr(String(e)));
    fetchEvidence(district)
      .then((e) => live && setEvidence(e))
      .catch(() => {});
    return () => { live = false; };
  }, [district]);

  // debounced what-if recompute
  useEffect(() => {
    if (!data) return;
    let live = true;
    setScBusy(true);
    const t = window.setTimeout(() => {
      runScenario(data.station_id, whatIf)
        .then((r) => live && setScenario(r))
        .catch(() => live && setScenario(null))
        .finally(() => live && setScBusy(false));
    }, 450);
    return () => { live = false; window.clearTimeout(t); };
  }, [data, whatIf]);

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
        <br /><span className="text-fg-muted">काय करावे: {TIER_GUIDANCE_MR[t.tier24]}</span>
        <br /><span className="text-fg-muted">Experimental guidance — not an official warning. अधिकृत सूचना नाही.</span>
      </div>

      {evidence && (
        <div className="mt-3 rounded-[var(--r-md)] border border-line bg-surface-2 p-3">
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${evidence.model_status === "model" ? "bg-green-500" : "bg-amber-500"}`} />
              <span className="text-fg-muted">source:</span>
              <span className="mono font-semibold">{evidence.model_status}</span>
            </span>
            <span className="text-fg-subtle">·</span>
            <span className="text-fg-muted">data as of {evidence.data_quality.as_of}</span>
          </div>
        </div>
      )}

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

      {data.drivers && (
        <>
          <h4 className="section-h">Why this risk</h4>
          <div className="grid gap-1.5">
            {[
              { k: `rain last 24h · ${data.drivers.rain_24h}mm`, p: data.drivers.rain_24h_pctile },
              { k: `rain last 7 days · ${data.drivers.rain_7d_mm}mm`, p: data.drivers.rain_7d_pctile },
              { k: `upstream rain, 1d ago · ${data.drivers.upstream_rain_lag1}mm` },
              { k: `upstream rain, 2d ago · ${data.drivers.upstream_rain_lag2}mm` },
            ].map((row) => (
              <div key={row.k} className="flex items-center gap-3 text-[12px]">
                <span className="min-w-0 flex-1 truncate text-fg-muted">{row.k}</span>
                {row.p !== undefined ? (
                  <span className="score-bar" style={{ width: 150 }}>
                    <span className="score-bar-track">
                      <span className="score-bar-fill"
                            style={{ width: `${Math.min(100, row.p)}%`,
                                     background: row.p >= 90 ? hex[3] : row.p >= 75 ? hex[2] : hex[0] }} />
                    </span>
                    <span className="score-bar-val">{Math.round(row.p)}%</span>
                  </span>
                ) : (
                  <span className="mono text-fg-subtle">—</span>
                )}
              </div>
            ))}
            <p className="text-[10.5px] leading-relaxed text-fg-subtle">
              Percentiles compare against the same calendar month across the
              5-year dataset — high percentile = unusual for the season, not
              just large in absolute terms.
            </p>
          </div>
        </>
      )}

      {evidence?.drivers && typeof evidence.drivers === "object" && !Array.isArray(evidence.drivers) && (
        <>
          <h4 className="section-h">Risk drivers (observed rainfall context)</h4>
          <div className="grid gap-1.5">
            {Object.entries(evidence.drivers as Record<string, number | null>).map(([k, v]) => (
              <div key={k} className="flex items-start gap-2 text-[12px]">
                <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                <span className="text-fg-muted mono">{k}: {v ?? "—"}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h4 className="section-h">
        Scenario lab — hypothetical rain tomorrow
      </h4>
      <div className="rounded-[var(--r-md)] border border-line bg-surface-2 p-3">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {[50, 100, 150, 200, 300].map((mm) => (
            <button
              key={mm}
              onClick={() => setWhatIf(mm)}
              className={`chip cursor-pointer !py-0.5 transition-colors
                          ${whatIf === mm
                            ? "!border-transparent !bg-accent !text-accent-fg"
                            : "hover:border-line-strong"}`}
            >
              {mm}mm
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range" min={0} max={300} step={10}
            value={whatIf}
            onChange={(e) => setWhatIf(Number(e.target.value))}
            aria-label="Hypothetical rainfall tomorrow, mm"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3
                       accent-[var(--accent-400)]"
          />
          <span className="mono w-16 shrink-0 text-right text-sm font-semibold">
            {scBusy ? "…" : `${whatIf}mm`}
          </span>
        </div>
        {scenario && !scBusy && (
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {[["+24h", scenario.baseline.tier24, scenario.scenario.tier24, scenario.scenario.p24, scenario.baseline.p24],
              ["+48h", scenario.baseline.tier48, scenario.scenario.tier48, scenario.scenario.p48, scenario.baseline.p48],
              ["+72h", scenario.baseline.tier72, scenario.scenario.tier72, scenario.scenario.p72, scenario.baseline.p72],
            ].map(([h, from, to, p, p0]) => {
              const dPts = Math.round(((p as number) - (p0 as number)) * 100);
              const tierJump = (to as number) > (from as number);
              return (
                <div key={h as string}
                     className={`rounded-md border bg-surface px-2 py-1.5 text-center ${
                       tierJump ? "border-orange-400/60" : "border-line"
                     }`}>
                  <p className="mono text-[10px] text-fg-subtle">{h}</p>
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <span className={`band ${BAND[from as number]}`}>{TIER_LABEL[from as number][0]}</span>
                    <span className="text-fg-subtle">→</span>
                    <span className={`band ${BAND[to as number]}`}>{TIER_LABEL[to as number][0]}</span>
                  </div>
                  <p className="mono mt-1 text-[10.5px] font-semibold">{pct(p as number, 0)}</p>
                  {dPts !== 0 && (
                    <p className="mono text-[9.5px]" style={{ color: dPts > 0 ? "#F0854D" : "#3FD4BC" }}>
                      {dPts > 0 ? "+" : ""}{dPts} pts
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-[10.5px] leading-relaxed text-fg-subtle">
          Simulated scenario — not an official forecast. The model window is
          extended by one hypothetical day with this much rain; upstream lags
          hold at last-known values. A planning tool for drills.
        </p>
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
