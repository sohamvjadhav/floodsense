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

export interface MapPayload {
  districts: DistrictRisk[];
  legend: [string, string][];
  impact: ImpactSummary;
}

export interface Drivers {
  rain_24h: number;
  rain_7d_mm: number;
  upstream_rain_lag1: number;
  upstream_rain_lag2: number;
  rain_24h_pctile?: number;
  rain_7d_pctile?: number;
}

export interface DistrictDetail {
  district: string;
  station_id: string;
  basin: string;
  as_of: string;
  risk: {
    p24: number;
    p48: number;
    p72: number;
    tier24: number;
    tier48: number;
    tier72: number;
    tier_name: string;
  };
  probability_curve: {
    horizon_h: number;
    p: number;
    tier: number;
    tier_name: string;
  }[];
  rainfall_recent: { date: string; rainfall_mm: number; forecast: boolean }[];
  risk_history: { updated_at: string; p24: number; p48: number; p72: number }[];
  drivers?: Drivers | null;
}

export interface ReplayEvent {
  date: string;
  name: string;
  note: string;
  peak_district?: string;
  peak_mm?: number;
}

export interface ReplayFrame {
  districts: DistrictRisk[];
  impact: ImpactSummary;
  date: string;
}

export interface ScenarioResult {
  station_id: string;
  district: string;
  as_of: string;
  baseline: ScenarioProbs;
  scenario: ScenarioProbs & { assumed_rain_mm: number };
}

interface ScenarioProbs {
  p24: number;
  p48: number;
  p72: number;
  tier24: number;
  tier48: number;
  tier72: number;
}

export interface HealthStatus {
  status: string;
  model_loaded: boolean;
  calibration_loaded: boolean;
  version: string;
  stations: number;
}
