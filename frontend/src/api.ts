export const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface DistrictRisk {
  station_id: string;
  district: string;
  basin: string;
  lat: number;
  lon: number;
  population: number;
  tier: number;
  tier_name: string;
  tiers: [number, number, number];
  color: string;
  p24: number;
  p48: number;
  p72: number;
  as_of: string | null;
  source: string;
  /* present in replay mode only */
  observed_date?: string;
  rainfall_24h?: number;
  rain_3d_mm?: number;
  rain_7d_mm?: number;
  flood_label?: number;
}

export interface ImpactSummary {
  horizon: number;
  population_total: number;
  population_alerting: number;
  districts_alerting: number;
}

export interface DistrictDetail {
  district: string;
  station_id: string;
  basin: string;
  as_of: string;
  risk: {
    p24: number; p48: number; p72: number;
    tier24: number; tier48: number; tier72: number; tier_name: string;
  };
  probability_curve: { horizon_h: number; p: number; tier: number; tier_name: string }[];
  rainfall_recent: { date: string; rainfall_mm: number; forecast: boolean }[];
  risk_history: { updated_at: string; p24: number; p48: number; p72: number }[];
  drivers?: Drivers | null;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API_URL}${path}`);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

export const fetchMap = () =>
  get<{ districts: DistrictRisk[]; legend: [string, string][]; impact: ImpactSummary }>(
    "/api/risk/map",
  );

export interface ReplayEvent {
  date: string;
  name: string;
  note: string;
  peak_district?: string;
  peak_mm?: number;
}

export const fetchReplay = (date: string) =>
  get<{ districts: DistrictRisk[]; legend: [string, string][]; impact: ImpactSummary } &
    { mode: "replay"; date: string }>(
    `/api/risk/replay?date=${date}`,
  );

export interface Drivers {
  rain_24h: number;
  rain_7d_mm: number;
  upstream_rain_lag1: number;
  upstream_rain_lag2: number;
  rain_24h_pctile?: number;
  rain_7d_pctile?: number;
}

export interface ScenarioResult {
  station_id: string;
  district: string;
  as_of: string;
  baseline: { p24: number; p48: number; p72: number; tier24: number; tier48: number; tier72: number };
  scenario: { p24: number; p48: number; p72: number; tier24: number; tier48: number; tier72: number; assumed_rain_mm: number };
}

export async function runScenario(stationId: string, rainMm: number): Promise<ScenarioResult> {
  const r = await fetch(`${API_URL}/api/risk/scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ station_id: stationId, rain_mm: rainMm }),
  });
  if (!r.ok) throw new Error(`scenario failed (${r.status})`);
  return r.json();
}

export interface ReplayFrame {
  districts: DistrictRisk[];
  impact: ImpactSummary;
  date: string;
}

export const fetchReplayRange = (start: string, days = 10) =>
  get<{ frames: ReplayFrame[] }>(
    `/api/risk/replay/range?start=${start}&days=${days}`,
  );

export const fetchReplayEvents = () =>
  get<{ events: ReplayEvent[] }>("/api/risk/replay/events");

export const fetchDistrict = (district: string) =>
  get<DistrictDetail>(`/api/risk/${encodeURIComponent(district)}`);

export async function subscribe(phone: string, district: string) {
  const r = await fetch(`${API_URL}/api/alerts/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, district }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => null);
    throw new Error(e?.detail?.[0]?.msg ?? "subscription failed");
  }
  return r.json();
}
