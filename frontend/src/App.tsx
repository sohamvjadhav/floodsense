import { useCallback, useEffect, useRef, useState } from "react";
import type { DistrictRisk } from "./api";
import { fetchMap } from "./api";
import { tierHex, useTheme } from "./theme";
import type { Horizon } from "./horizon";
import MapView from "./components/MapView";
import DistrictDetail from "./components/DistrictDetail";
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
    timer.current = window.setInterval(() => setUpdatedAt((t) => t), 30_000);
    return () => window.clearInterval(timer.current);
  }, [load]);

  const live = !error && districts.length > 0;
  const hIdx = horizon / 24 - 1;
  const worst = districts.length
    ? [...districts].sort((a, b) => b.tiers[hIdx] - a.tiers[hIdx] || b.p24 - a.p24)[0]
    : null;
  const worstTier = worst ? worst.tiers[hIdx] : 0;

  const exposure = districts.reduce(
    (acc, d) => {
      if (d.tiers[hIdx] >= 2) { acc.pop += d.population; acc.n += 1; }
      return acc;
    },
    { pop: 0, n: 0 },
  );
  const popTotal = districts.reduce((s, d) => s + d.population, 0);
  const selectedPop = districts.find((d) => d.district === selected)?.population;

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
            {live ? <>live<span className="hidden sm:inline"> · {timeAgo(updatedAt)}</span></> : "API offline"}
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" />
                </svg>
              </span>
              <span className="kpi-value">{districts.length}</span>
              <span className="kpi-label">Districts monitored</span>
              <span className="kpi-sub">3 basins · Census 2011 exposure base</span>
            </div>
            <div className={`kpi ${exposure.n > 0 ? "kpi-warn" : ""}`}>
              <span className="kpi-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.3 3.9 2.5 18a1.8 1.8 0 0 0 1.6 2.7h15.8a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
                  <path d="M12 9v4m0 3.5v.5" />
                </svg>
              </span>
              <span className="kpi-value">{exposure.n}</span>
              <span className="kpi-label">At High+ risk (+{horizon}h)</span>
              <span className="kpi-sub">
                {exposure.n ? `${compactIn.format(exposure.pop)} people in alert districts` : "no districts above High"}
              </span>
            </div>
            <div className={`kpi ${exposure.pop > 0 ? "kpi-warn" : ""}`}>
              <span className="kpi-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <span className="kpi-value">{compactIn.format(exposure.pop)}</span>
              <span className="kpi-label">Population exposed</span>
              <span className="kpi-sub">of {compactIn.format(popTotal)} monitored</span>
            </div>
            <div className="kpi">
              <span className="kpi-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
              </span>
              <span className="kpi-value">+72h</span>
              <span className="kpi-label">Forecast window</span>
              <span className="kpi-sub">{updatedAt ? `updated ${timeAgo(updatedAt)}` : ""}</span>
            </div>
          </div>
        </div>
      )}

      <main className="main">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_400px]">
          <div className="panel !p-2.5 min-h-0 sm:min-h-[440px]">
            {districts.length === 0 && !error ? (
              <div className="skeleton h-full w-full" style={{ minHeight: 420, borderRadius: "var(--r-lg)" }} />
            ) : (
              <MapView districts={districts} selected={selected} onSelect={setSelected}
                       horizon={horizon} onHorizonChange={setHorizon} />
            )}
          </div>

          <div className="grid gap-5 content-start">
            {selected ? (
              <DistrictDetail
                district={selected}
                onClose={() => setSelected(null)}
                population={selectedPop}
              />
            ) : (
              districts.length > 0 && !error && (
                <DistrictList districts={districts} selected={selected}
                              onSelect={setSelected} horizon={horizon} />
              )
            )}
            <SubscribeForm districts={districts.map((d) => d.district)} />
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
