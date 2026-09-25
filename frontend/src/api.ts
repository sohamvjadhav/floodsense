export const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface Provenance {
  mode: string;
  mode_note: string;
  source: string;
  as_of: string | null;
  age_hours: number | null;
  is_stale: boolean;
  freshness_warning: boolean;
  stale_threshold_hours: number;
}

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
  provenance?: Provenance;
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

export interface HealthStatus {
  status: string;
  mode?: string;
  mode_note?: string;
  model_loaded: boolean;
  calibration_loaded: boolean;
  calibration_status?: string;
  version: string;
  stations: number;
}

export interface ModelInfo {
  model_type: string;
  version: string;
  mode?: string;
  window_days: number;
  horizons: number[];
  calibration: string;
  label_source?: string;
  training_split: string;
  model_loaded: boolean;
  n_seq_features?: number;
  n_static_features?: number;
}

export interface ModelMetrics {
  split?: string;
  n?: number;
  f1_24h?: number;
  precision_24h?: number;
  recall_24h?: number;
  brier_24h?: number;
  f1_48h?: number;
  precision_48h?: number;
  recall_48h?: number;
  brier_48h?: number;
  f1_72h?: number;
  precision_72h?: number;
  recall_72h?: number;
  brier_72h?: number;
}

export interface EvidenceResult {
  district: string;
  station_id: string;
  risk: { p24: number; p48: number; p72: number; tier24: number; tier48: number; tier72: number };
  data_quality: { source: string; as_of: string };
  drivers?: Drivers | { [k: string]: number | null } | null;
  model_status: string;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API_URL}${path}`);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

export const fetchMap = () =>
  get<{ districts: DistrictRisk[]; legend: [string, string][]; impact: ImpactSummary } &
    { mode?: string; mode_note?: string; stale_count?: number }>(
    "/api/risk/map",
  );

export const fetchHealth = () =>
  get<HealthStatus>("/api/health");

export const fetchModelInfo = () =>
  get<ModelInfo>("/api/model/info");

export const fetchModelMetrics = () =>
  get<ModelMetrics>("/api/model/metrics");

export const fetchEvidence = (district: string) =>
  get<EvidenceResult>(`/api/risk/${encodeURIComponent(district)}/evidence`);

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

export async function unsubscribe(phone: string, district: string) {
  const r = await fetch(`${API_URL}/api/alerts/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, district }),
  });
  if (!r.ok) throw new Error("unsubscribe failed");
  return r.json();
}
