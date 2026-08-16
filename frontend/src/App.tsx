import { useCallback, useEffect, useRef, useState } from "react";
import type { DistrictRisk, ReplayEvent } from "./api";
import { fetchMap, fetchReplay, fetchReplayEvents, fetchReplayRange,
         type ReplayFrame } from "./api";
import { tierHex, useTheme } from "./theme";
import type { Horizon } from "./horizon";
import MapView from "./components/MapView";
import DistrictDetail from "./components/DistrictDetail";
import ReplayDetail from "./components/ReplayDetail";
import DistrictList from "./components/DistrictList";
import SubscribeForm from "./components/SubscribeForm";
import ThemeToggle from "./components/ThemeToggle";

const TIER_LABEL = ["Low", "Medium", "High", "Severe"];
const compactIn = new Intl.NumberFormat("en-IN", {
  notation: "compact", compactDisplay: "short",
});

function BrandMark() {
  return (
    <span className="brand-mark">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2.1" strokeLinecap="round">
        <path d="M3 15c2.4-4.8 4.2-4.8 6.6 0s4.2 4.8 6.6 0" />
        <path d="M6.6 8.4C8 5.2 9.2 5.2 10.6 8.4" opacity=".55" />
      </svg>
    </span>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function App() {
  const [districts, setDistricts] = useState<DistrictRisk[]>([]);
  const [horizon, setHorizon] = useState<Horizon>(24);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [replayDate, setReplayDate] = useState<string | null>(null);
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const { theme } = useTheme();
  const hex = tierHex(theme === "dark");

  const load = useCallback(() => {
    setLoading(true);
    fetchMap()
      .then((d) => {
        setDistricts(d.districts);
        setError(null);
        setUpdatedAt(new Date().toISOString());
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    fetchReplayEvents().then((e) => setEvents(e.events)).catch(() => {});
    timer.current = window.setInterval(() => setUpdatedAt((t) => t), 30_000);
    return () => window.clearInterval(timer.current);
  }, [load]);

  // displayed districts: live map, or the replayed historical snapshot
  const [replayed, setReplayed] = useState<DistrictRisk[] | null>(null);
  const [replayBusy, setReplayBusy] = useState(false);
  const [play, setPlay] = useState<{ frames: ReplayFrame[]; idx: number; playing: boolean } | null>(null);
  useEffect(() => {
    if (!replayDate) { setReplayed(null); return; }
    setReplayBusy(true);
    fetchReplay(replayDate)
      .then((r) => setReplayed(r.districts))
      .catch(() => setReplayed(null))
      .finally(() => setReplayBusy(false));
  }, [replayDate]);
  useEffect(() => {
    if (!play?.playing) return;
    if (play.idx >= play.frames.length - 1) {
      setPlay((p) => (p ? { ...p, playing: false } : null));
      return;
    }
    const t = window.setTimeout(
      () => setPlay((p) => (p ? { ...p, idx: p.idx + 1 } : null)),
      1100,
    );
    return () => window.clearTimeout(t);
  }, [play]);

  const startPlayback = (evDate: string) => {
    const start = new Date(evDate);
    start.setDate(start.getDate() - 6);
    const iso = start.toISOString().slice(0, 10);
    setReplayDate(null);
    setReplayed(null);
    fetchReplayRange(iso, 10)
      .then((r) => setPlay({ frames: r.frames, idx: 0, playing: true }))
      .catch(() => setPlay(null));
  };

  const shown = play
    ? play.frames[play.idx].districts
    : replayed ?? districts;
  const displayDate = play ? play.frames[play.idx].date : replayDate;
  const activeEvent = events.find((e) => e.date === (play ? undefined : replayDate))
    ?? (play
      ? events.find((e) => e.date >= (play.frames[play.idx]?.date ?? "")
          && new Date(e.date).getTime() - new Date(play.frames[play.idx].date).getTime() < 7 * 864e5)
      : null);

  const live = !error && districts.length > 0;
  const hIdx = horizon / 24 - 1;
  const worst = shown.length
    ? [...shown].sort((a, b) => b.tiers[hIdx] - a.tiers[hIdx] || b.p24 - a.p24)[0]
    : null;
  const worstTier = worst ? worst.tiers[hIdx] : 0;

  const exposure = shown.reduce(
    (acc, d) => {
      if (d.tiers[hIdx] >= 2) { acc.pop += d.population; acc.n += 1; }
      return acc;
    },
    { pop: 0, n: 0 },
  );
  const popTotal = shown.reduce((s, d) => s + d.population, 0);
  const selectedPop = shown.find((d) => d.district === selected)?.population;
  const selectedEntry = shown.find((d) => d.district === selected);

  return (
    <div className="app-shell flex flex-col">
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          <div className="brand-text">
            <span className="brand-name">FloodSense</span>
            <span className="brand-sub">
              24–72h flood risk · Godavari / Krishna / Konkan
            </span>
          </div>
        </div>

        <div className="topnav">
          {worst && (
            <button
              onClick={() => setSelected(worst.district)}
              className="chip cursor-pointer hover:border-line-strong hide-mobile"
              title="Open highest-risk district"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: hex[worstTier] }} />
              {worst.district}
              <span className="mono" style={{ color: hex[worstTier] }}>
                {TIER_LABEL[worstTier]}
              </span>
            </button>
          )}
          <span className={`chip ${live ? "chip-live" : "chip-off"}`}>
            <span className="relative flex h-1.5 w-1.5">
              {live && (
                <span className="absolute inline-flex h-full w-full animate-ping
                                 rounded-full opacity-60 motion-reduce:animate-none"
                      style={{ background: "currentColor" }} />
              )}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full"
                    style={{ background: "currentColor" }} />
            </span>
            {(play || replayDate) ? "replay" : live ? <>live<span className="hidden sm:inline"> · {timeAgo(updatedAt)}</span></> : "API offline"}
          </span>
          <button onClick={load} disabled={loading} className="btn">
            <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
            </svg>
            {loading ? "Refreshing" : "Refresh"}
          </button>
          <ThemeToggle />
        </div>
      </header>

      {error && (
        <div className="main !pt-5 !pb-0">
          <div className="panel anim-in">
            <div className="panel-head"><h3>Can't reach the FloodSense API</h3></div>
            <p className="explain-text">
              Start it with <span className="mono">.venv/bin/uvicorn api.main:app --port 8000</span>
              <br /><span className="mono text-fg-subtle">{error}</span>
            </p>
          </div>
        </div>
      )}

      {live && (
        <div className="main !pb-0">
          <div className="kpis anim-in">
            <div className="kpi">
              <span className="kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" />
                </svg>
              </span>
              <span className="kpi-main">
                <span className="kpi-value">{shown.length}</span>
                <span className="kpi-label">districts · {new Set(shown.map((d) => d.basin)).size} basins</span>
              </span>
            </div>
            <div className={`kpi ${exposure.n > 0 ? "kpi-warn" : ""}`}>
              <span className="kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.3 3.9 2.5 18a1.8 1.8 0 0 0 1.6 2.7h15.8a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
                  <path d="M12 9v4m0 3.5v.5" />
                </svg>
              </span>
              <span className="kpi-main">
                <span className="kpi-value">{exposure.n}</span>
                <span className="kpi-label">at High+ risk (+{horizon}h)</span>
              </span>
            </div>
            <div className={`kpi ${exposure.pop > 0 ? "kpi-warn" : ""}`}>
              <span className="kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <span className="kpi-main">
                <span className="kpi-value">{compactIn.format(exposure.pop)}</span>
                <span className="kpi-label">exposed of {compactIn.format(popTotal)}</span>
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
              </span>
              <span className="kpi-main">
                <span className="kpi-value">+72h</span>
                <span className="kpi-label">forecast window</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {live && (
        <div className="main !pt-0">
          <div className="panel anim-in !py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="section-h !m-0 shrink-0">Historical replay</span>
              <input
                type="date"
                value={replayDate ?? ""}
                min="2021-08-20"
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setReplayDate(e.target.value || null)}
                aria-label="Replay date"
                className="composer-field mono !w-auto cursor-pointer"
                style={{ padding: "2px 6px 2px 10px" }}
              />
              {replayDate && (
                <button onClick={() => setReplayDate(null)} className="btn btn-primary !py-1">
                  ● Return to live
                </button>
              )}
              {replayBusy && <span className="chip mono">replaying…</span>}
              {play && (
                <span className="chip !gap-2">
                  <button
                    aria-label={play.playing ? "Pause playback" : "Resume playback"}
                    onClick={() => setPlay((p) => (p ? { ...p, playing: !p.playing } : null))}
                    className="text-fg-muted hover:text-fg"
                  >
                    {play.playing ? "⏸" : "▶"}
                  </button>
                  <span className="mono">
                    {play.frames[play.idx].date} · day {play.idx + 1}/{play.frames.length}
                  </span>
                  <button
                    aria-label="Stop playback"
                    onClick={() => setPlay(null)}
                    className="text-fg-muted hover:text-fg"
                  >
                    ✕
                  </button>
                </span>
              )}
              {activeEvent && (
                <span className="chip">
                  {activeEvent.name}
                  <span className="mono">{activeEvent.note}</span>
                </span>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {events.map((ev) => (
                  <button
                    key={ev.date}
                    onClick={() => (play ? setPlay(null) : startPlayback(ev.date))}
                    title={`${ev.note}${ev.peak_mm ? ` · peak ${ev.peak_mm}mm (${ev.peak_district})` : ""}`}
                    className={`chip cursor-pointer transition-colors
                                ${ev.date === replayDate
                                  ? "!border-transparent !bg-accent !text-accent-fg"
                                  : "hover:border-line-strong"}`}
                  >
                    ▶ {ev.name}
                    <span className="mono">{ev.date.slice(5)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="main">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_400px]">
          <div className="panel !p-2.5 min-h-0 sm:min-h-[440px]">
            {shown.length === 0 && !error ? (
              <div className="skeleton h-full w-full" style={{ minHeight: 420, borderRadius: "var(--r-lg)" }} />
            ) : (
              <MapView districts={shown} selected={selected} onSelect={setSelected}
                       horizon={horizon} onHorizonChange={setHorizon} />
            )}
          </div>

          <div className="grid gap-5 content-start">
            {selected && selectedEntry ? (
              displayDate && selectedEntry.rainfall_24h !== undefined ? (
                <ReplayDetail d={selectedEntry} onClose={() => setSelected(null)} />
              ) : (
                <DistrictDetail
                  district={selected}
                  onClose={() => setSelected(null)}
                  population={selectedPop}
                />
              )
            ) : (
              shown.length > 0 && !error && (
                <DistrictList districts={shown} selected={selected}
                              onSelect={setSelected} horizon={horizon} />
              )
            )}
            <SubscribeForm districts={shown.map((d) => d.district)} />
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="footer-row">
          <span>Heuristic-label validation phase — see README before quoting risk numbers.</span>
          <span>Rainfall: Open-Meteo · Imagery: Esri / CARTO · OSM contributors</span>
        </div>
      </footer>
    </div>
  );
}
