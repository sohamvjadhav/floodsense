import { apiGet, apiPost } from "./client";
import type {
  DistrictDetail,
  HealthStatus,
  MapPayload,
  ReplayEvent,
  ReplayFrame,
  ScenarioResult,
} from "./types";

export const fetchMap = () => apiGet<MapPayload>("/api/risk/map");

export const fetchHealth = () => apiGet<HealthStatus>("/api/health");

export const fetchDistrict = (district: string) =>
  apiGet<DistrictDetail>(`/api/risk/${encodeURIComponent(district)}`);

export const fetchReplayEvents = () =>
  apiGet<{ events: ReplayEvent[] }>("/api/risk/replay/events");

export const fetchReplayRange = (start: string, days = 10) =>
  apiGet<{ frames: ReplayFrame[] }>(
    `/api/risk/replay/range?start=${start}&days=${days}`,
  );

export const runScenario = (stationId: string, rainMm: number) =>
  apiPost<ScenarioResult>("/api/risk/scenario", {
    station_id: stationId,
    rain_mm: rainMm,
  });

export const subscribe = (phone: string, district: string) =>
  apiPost<{ ok: boolean }>("/api/alerts/subscribe", { phone, district });

export const unsubscribe = (phone: string, district: string) =>
  apiPost<{ ok: boolean }>("/api/alerts/unsubscribe", { phone, district });
