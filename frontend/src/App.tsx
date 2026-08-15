import { useEffect, useState } from "react";
import { DistrictRisk, fetchMap } from "./api";
import MapView from "./components/MapView";
import DistrictDetail from "./components/DistrictDetail";
import SubscribeForm from "./components/SubscribeForm";

const TIER_DOT = ["bg-green-500", "bg-yellow-400", "bg-orange-500", "bg-red-600"];

export default function App() {
  const [districts, setDistricts] = useState<DistrictRisk[]>([]);
  const [legend, setLegend] = useState<[string, string][]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchMap()
      .then((d) => { setDistricts(d.districts); setLegend(d.legend); setError(null); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const worst = [...districts].sort((a, b) => b.tier - a.tier)[0];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌊</span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">FloodSense</h1>
            <p className="text-xs text-slate-400">
              24–72h flood risk forecast · Godavari / Krishna / Konkan basins
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs">
          {legend.map(([name, color]) => (
            <span key={name} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              {name}
            </span>
          ))}
          <button
            onClick={load}
            className="rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 font-medium transition-colors"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 rounded-lg bg-red-950/60 border border-red-800 px-4 py-3 text-sm text-red-200">
          API unreachable ({error}). Start the backend: <code className="text-red-100">.venv/bin/uvicorn api.main:app --port 8000</code>
        </div>
      )}

      {worst && (
        <div className="mx-6 mt-4 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${TIER_DOT[worst.tier]}`} />
          Highest current risk:{" "}
          <button className="font-semibold underline underline-offset-2"
                  onClick={() => setSelected(worst.district)}>
            {worst.district}
          </button>
          <span className="text-slate-400">
            — {worst.tier_name} · 24h probability {(worst.p24 * 100).toFixed(1)}%
          </span>
        </div>
      )}

      <main className="flex-1 grid lg:grid-cols-[1fr_420px] gap-4 p-6">
        <MapView districts={districts} selected={selected} onSelect={setSelected} />
        <aside className="flex flex-col gap-4 min-w-0">
          {selected ? (
            <DistrictDetail district={selected} onClose={() => setSelected(null)} />
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
              Select a district on the map to see its 72-hour risk curve,
              recent rainfall, and forecast outlook.
            </div>
          )}
          <SubscribeForm districts={districts.map((d) => d.district)} />
        </aside>
      </main>

      <footer className="border-t border-slate-800 px-6 py-3 text-xs text-slate-500">
        Heuristic-label pipeline validation phase — see README before quoting
        risk numbers. Rainfall: Open-Meteo.
      </footer>
    </div>
  );
}
