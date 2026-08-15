import { useCallback, useEffect, useRef, useState } from "react";
import type { DistrictRisk, ImpactSummary } from "./api";
import { fetchMap } from "./api";
import { TIER_STYLES, pct } from "./theme";
import type { Horizon } from "./horizon";
import MapView from "./components/MapView";
import DistrictDetail from "./components/DistrictDetail";
import DistrictList from "./components/DistrictList";
import SubscribeForm from "./components/SubscribeForm";
import ThemeToggle from "./components/ThemeToggle";
import { Card, ErrorState, SkeletonBlock } from "./components/States";

const compactIn = new Intl.NumberFormat("en-IN", {
  notation: "compact", compactDisplay: "short",
});

function BrandMark() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl
                    bg-gradient-to-br from-sky-500 to-cyan-600 text-white
                    shadow-sm">
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2.2" strokeLinecap="round">
        <path d="M3 15c2.4-4.8 4.2-4.8 6.6 0s4.2 4.8 6.6 0" />
        <path d="M6.6 8.4C8 5.2 9.2 5.2 10.6 8.4" opacity="0.55" />
      </svg>
    </div>
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
    timer.current = window.setInterval(
      () => setUpdatedAt((t) => t), // re-render for "time ago"
      30_000,
    );
    return () => window.clearInterval(timer.current);
  }, [load]);

  const live = !error && districts.length > 0;
  const hIdx = horizon / 24 - 1;
  const worst = districts.length
    ? [...districts].sort((a, b) => b.tiers[hIdx] - a.tiers[hIdx] || b.p24 - a.p24)[0]
    : null;
  const alerting = worst && worst.tiers[hIdx] >= 2;

  // exposure at the selected horizon, recomputed client-side so the
  // scrubber updates it instantly without a refetch
  const exposure = districts.reduce(
    (acc, d) => {
      if (d.tiers[hIdx] >= 2) { acc.pop += d.population; acc.n += 1; }
      return acc;
    },
    { pop: 0, n: 0 },
  );
  const popTotal = districts.reduce((s, d) => s + d.population, 0);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-[600] border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <h1 className="text-[15px] font-extrabold leading-tight tracking-tight">
                FloodSense
              </h1>
              <p className="text-[11px] leading-tight text-fg-muted">
                24–72h flood risk · Godavari / Krishna / Konkan
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <span
              role="status"
              className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1
                          text-[11px] font-medium sm:inline-flex
                          ${live
                            ? "border-tier-low/25 bg-tier-low/10 text-tier-low"
                            : "border-tier-severe/25 bg-tier-severe/10 text-tier-severe"}`}
            >
              <span className="relative flex h-1.5 w-1.5">
                {live && (
                  <span className="absolute inline-flex h-full w-full animate-ping
                                   rounded-full bg-tier-low opacity-60 motion-reduce:animate-none" />
                )}
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full"
                      style={{ background: live ? "var(--tier-low)" : "var(--tier-severe)" }} />
              </span>
              {live ? `API live${updatedAt ? ` · ${timeAgo(updatedAt)}` : ""}` : "API offline"}
            </span>

            <button
              onClick={load}
              disabled={loading}
              className="flex h-9 items-center gap-2 rounded-full border border-line
                         bg-surface px-3.5 text-xs font-semibold text-fg-muted
                         hover:border-line-strong hover:text-fg
                         disabled:opacity-60 focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-accent/60
                         transition-colors"
            >
              <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}
                   viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
              </svg>
              {loading ? "Refreshing" : "Refresh"}
            </button>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto mt-4 w-full max-w-[1440px] px-4 sm:px-6">
          <ErrorState
            message="Can't reach the FloodSense API"
            hint={`Start it with: .venv/bin/uvicorn api.main:app --port 8000  (${error})`}
          />
        </div>
      )}

      {worst && (
        <div className="mx-auto mt-4 w-full max-w-[1440px] px-4 sm:px-6">
          <button
            onClick={() => setSelected(worst.district)}
            className={`anim-in flex w-full items-center gap-2.5 rounded-xl border px-4 py-3
                        text-left text-[13px] hover:border-line-strong
                        focus-visible:outline-none focus-visible:ring-2
                        focus-visible:ring-accent/60 transition
                        ${TIER_STYLES[worst.tier].soft}`}
          >
            <span className={`h-2 w-2 rounded-full ${TIER_STYLES[worst.tier].dot}`}
                  style={alerting ? { animation: "pulse-ring 2s ease-out infinite" } : undefined} />
            <span className="font-semibold">Highest current risk — {worst.district}</span>
            <span className={`${TIER_STYLES[worst.tier].fg} font-semibold`}>
              {worst.tier_name}
            </span>
            <span className="num text-fg-muted">
              24h probability {pct(worst.p24)}
            </span>
            <span className="ml-auto text-fg-subtle">view details →</span>
          </button>
        </div>
      )}

      <main className="mx-auto grid w-full max-w-[1440px] flex-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-h-[420px]">
          {districts.length === 0 && !error
            ? <Card className="h-full min-h-[420px] p-4">
                <SkeletonBlock className="h-full w-full" />
              </Card>
            : <MapView districts={districts} selected={selected} onSelect={setSelected} />}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          {selected ? (
            <DistrictDetail district={selected} onClose={() => setSelected(null)} />
          ) : (
            districts.length === 0 && !error ? (
              <Card className="space-y-3 p-5">
                <SkeletonBlock className="h-5 w-36" />
                <SkeletonBlock className="h-[248px] w-full" />
              </Card>
            ) : (
              <DistrictList districts={districts} selected={selected} onSelect={setSelected} />
            )
          )}
          <SubscribeForm districts={districts.map((d) => d.district)} />
        </aside>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-1
                        px-4 py-3 text-[11px] text-fg-subtle sm:px-6">
          <span>
            Heuristic-label validation phase — see README before quoting risk numbers.
          </span>
          <span className="ml-auto">
            Rainfall: Open-Meteo · Basemaps: © OpenStreetMap / CARTO
          </span>
        </div>
      </footer>
    </div>
  );
}
