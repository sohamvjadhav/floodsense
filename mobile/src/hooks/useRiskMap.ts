import { useCallback, useEffect, useState } from "react";
import { fetchMap } from "../api/endpoints";
import type { DistrictRisk, HealthStatus } from "../api/types";
import { fetchHealth } from "../api/endpoints";

export function useRiskMap() {
  const [districts, setDistricts] = useState<DistrictRisk[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchMap()
      .then((d) => {
        setDistricts(d.districts);
        setError(null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    fetchHealth().then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { districts, health, loading, error, refresh: load };
}
