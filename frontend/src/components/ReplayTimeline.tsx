import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer,
  Tooltip as ChartTooltip, XAxis, YAxis,
} from "recharts";
import type { ReplayFrame } from "../api";
import { tierHex, useChartTheme, useTheme, pct } from "../theme";

const TIER_LABEL = ["Low", "Medium", "High", "Severe"];

/** Restrained operator actions — never automatic evacuation orders. */
const TIER_ACTION = [
  "Routine monitoring — no escalation needed.",
  "Increase monitoring frequency; verify local rain gauges.",
  "Notify district control room; pre-position response resources.",
  "Escalate to emergency protocols; verify low-lying settlements.",
];

interface DayStat {
  date: string;
  worst: number;
  nAlerting: number;
  pop: number;
  eventDay: boolean;
  maxP24: number;
}

export default function ReplayTimeline({
  frames, idx, onSelect,
}: {
  frames: ReplayFrame[];
  idx: number;
  onSelect: (i: number) => void;
}) {
  const { theme } = useTheme();
  const hex = tierHex(theme === "dark");
  const { axis, grid, tooltipBg, tooltipBorder, tooltipFg } = useChartTheme();

  const stats: DayStat[] = frames.map((f) => {
    const alerting = f.districts.filter((d) => d.tiers[0] >= 2);
    return {
      date: f.date,
      worst: f.districts.reduce((m, d) => Math.max(m, d.tiers[0]), 0),
      nAlerting: alerting.length,
      pop: alerting.reduce((s, d) => s + d.population, 0),
      eventDay: f.districts.some((d) => d.flood_label === 1),
      maxP24: f.districts.reduce((m, d) => Math.max(m, d.p24), 0),
    };
  });

  const firstAlert = stats.findIndex((s) => s.worst >= 2);
  const firstEvent = stats.findIndex((s) => s.eventDay);
  const leadDays =
    firstAlert >= 0 && firstEvent >= 0 ? firstEvent - firstAlert : null;

  const cur = stats[idx];
  const compactIn = new Intl.NumberFormat("en-IN", {
    notation: "compact", compactDisplay: "short",
  });

  const tooltipStyle = {
    background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 10,
    color: tooltipFg, fontSize: 12, fontFamily: "JetBrains Mono, monospace",
  };

  const chartData = stats.map((s) => ({
    date: s.date.slice(5),
    p24: Math.round(s.maxP24 * 1000) / 1000,
  }));

  return (
    <div className="grid gap-4">
      {/* ── decision card ─────────────────────────────────────────── */}
      <div className="rounded-[var(--r-md)] border border-line bg-surface-2 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
              Operator briefing · {cur.date}
            </p>
            <p className="mt-1 text-[13px] leading-snug">
              <span className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle"
                    style={{ background: hex[cur.worst] }} />
              <strong>{TIER_LABEL[cur.worst]}</strong> statewide peak ·{" "}
              <span className="mono">{cur.nAlerting}</span> district
              {cur.nAlerting === 1 ? "" : "s"} at High+ ·{" "}
              <span className="mono">{compactIn.format(cur.pop)}</span> residents
              in monitored high-risk districts
            </p>
          </div>
          <div className="ml-auto max-w-[320px] rounded-lg border border-line bg-surface px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
              Suggested action
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">
              {TIER_ACTION[cur.worst]}
            </p>
          </div>
        </div>
      </div>

      {/* ── risk trajectory ───────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
          Statewide 24h-risk trajectory (worst district)
        </p>
        <ResponsiveContainer width="100%" height={92}>
          <AreaChart data={chartData} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: axis, fontSize: 10, fontFamily: "JetBrains Mono" }}
                   axisLine={{ stroke: grid }} tickLine={false} interval="preserveStartEnd" />
            <YAxis domain={[0, 1]} tickFormatter={(p) => `${Math.round(p * 100)}%`}
                   tick={{ fill: axis, fontSize: 10, fontFamily: "JetBrains Mono" }}
                   axisLine={false} tickLine={false} />
            <ChartTooltip contentStyle={tooltipStyle}
                          formatter={(v: number) => [pct(v), "peak 24h risk"]}
                          labelFormatter={(d) => `day ${d}`} />
            {firstEvent >= 0 && (
              <ReferenceLine x={stats[firstEvent].date.slice(5)} stroke={hex[3]}
                             strokeDasharray="4 2"
                             label={{ value: "event", fill: hex[3], fontSize: 10,
                                      fontFamily: "JetBrains Mono", position: "insideTopRight" }} />
            )}
            {firstAlert >= 0 && (
              <ReferenceLine x={stats[firstAlert].date.slice(5)} stroke={hex[2]}
                             strokeDasharray="4 2"
                             label={{ value: "alert", fill: hex[2], fontSize: 10,
                                      fontFamily: "JetBrains Mono", position: "insideTopLeft" }} />
            )}
            <Area type="monotone" dataKey="p24" stroke="#3FD4BC"
                  fill="rgba(63,212,188,0.14)" strokeWidth={2} dot={false}
                  isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── day-by-day timeline strip ─────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
          Decision timeline — click a day to jump
        </p>
        <div className="mt-1.5 flex items-stretch gap-1 overflow-x-auto pb-1">
          {stats.map((s, i) => {
            const active = i === idx;
            const past = i <= idx;
            return (
              <button
                key={s.date}
                onClick={() => onSelect(i)}
                title={`${s.date} · peak ${TIER_LABEL[s.worst]}${s.eventDay ? " · observed event" : ""}`}
                className={`group relative flex min-w-[52px] flex-1 flex-col items-center
                            rounded-lg border px-1 py-1.5 transition-all
                            ${active
                              ? "border-accent bg-surface-3 shadow-sm"
                              : "border-line hover:border-line-strong bg-surface"}`}
                style={past && !active ? { opacity: 0.55 } : undefined}
              >
                <span className="mono text-[9.5px] text-fg-subtle">{s.date.slice(5)}</span>
                <span className="mt-1 h-1.5 w-full rounded-full"
                      style={{ background: hex[s.worst] }} />
                <span className="mt-1 flex items-center gap-0.5 text-[9px] leading-none">
                  {firstAlert === i && <span style={{ color: hex[2] }}>▲</span>}
                  {firstEvent === i && <span style={{ color: hex[3] }}>●</span>}
                  {firstAlert !== i && firstEvent !== i && (
                    <span className="text-fg-subtle">{s.nAlerting > 0 ? s.nAlerting : "·"}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-1 flex gap-4 text-[10px] text-fg-subtle">
          <span><span style={{ color: hex[2] }}>▲</span> first High-tier alert</span>
          <span><span style={{ color: hex[3] }}>●</span> observed event onset</span>
        </div>
      </div>

      {/* ── lead-time verdict ─────────────────────────────────────── */}
      {firstEvent >= 0 && (
        <div className={`rounded-[var(--r-md)] border px-3 py-2.5 ${
          leadDays == null
            ? "border-line bg-surface-2"
            : leadDays > 0
              ? "border-teal-500/40 bg-teal-500/10"
              : leadDays === 0
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-red-500/40 bg-red-500/10"
        }`}>
          {leadDays == null ? (
            <p className="text-[12px] text-fg-muted">
              No High-tier alert was raised in this window before the observed event.
            </p>
          ) : leadDays > 0 ? (
            <p className="text-[12px] leading-snug">
              <strong style={{ color: "#3FD4BC" }}>
                Useful lead time: ~{leadDays * 24}h
              </strong>{" "}
              — FloodSense crossed High tier {leadDays} day{leadDays === 1 ? "" : "s"}{" "}
              before the observed event.
            </p>
          ) : leadDays === 0 ? (
            <p className="text-[12px] leading-snug">
              <strong style={{ color: "#E0A93C" }}>Same-day flag.</strong> The alert
              fired on the event day — no actionable lead time in this window.
            </p>
          ) : (
            <p className="text-[12px] leading-snug">
              <strong style={{ color: "#F26666" }}>Missed early warning.</strong> The
              High-tier alert came {-leadDays} day{leadDays === -1 ? "" : "s"} after
              onset — shown honestly, not hidden.
            </p>
          )}
        </div>
      )}

      <p className="text-[10.5px] leading-relaxed text-fg-subtle">
        Replay shows only information available on each day — the model window
        never sees future rainfall. Event onset comes from the observed
        flood-label record, overlaid afterwards for comparison.
      </p>
    </div>
  );
}
