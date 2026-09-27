import { useMemo } from "react";
import {
  View, Text, FlatList, RefreshControl, StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useRiskMap } from "../hooks/useRiskMap";
import DistrictRow from "../components/DistrictRow";
import { C, compactIn } from "../theme";
import type { RootStackParamList } from "../../App";

export default function ListScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const { districts, health, loading, error, refresh } = useRiskMap();
  const insets = useSafeAreaInsets();

  const sorted = useMemo(
    () =>
      [...districts].sort(
        (a, b) => b.tiers[0] - a.tiers[0] || b.p24 - a.p24,
      ),
    [districts],
  );
  const alerting = districts.filter((d) => d.tiers[0] >= 2);
  const exposed = alerting.reduce((s, d) => s + d.population, 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.kpis}>
        <Kpi value={String(districts.length)} label="districts" />
        <Kpi
          value={String(alerting.length)}
          label="at High+ (24h)"
          warn={alerting.length > 0}
        />
        <Kpi value={compactIn(exposed)} label="exposed" warn={exposed > 0} />
      </View>
      {health && (
        <Text style={styles.health}>
          GRU v1 · model {health.model_loaded ? "loaded" : "missing"} ·
          calibration {health.calibration_loaded ? "loaded" : "missing"} ·
          v{health.version}
        </Text>
      )}
      {error && <Text style={styles.error}>API offline — {error}</Text>}
      <FlatList
        data={sorted}
        keyExtractor={(d) => d.station_id}
        contentContainerStyle={{ gap: 8, padding: 16, paddingBottom: 32 }}
        renderItem={({ item, index }) => (
          <DistrictRow
            d={item}
            rank={index + 1}
            onPress={() => navigation.navigate("District", { district: item.district })}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={C.accent} />
        }
      />
    </View>
  );
}

function Kpi({ value, label, warn }: { value: string; label: string; warn?: boolean }) {
  return (
    <View style={[styles.kpi, warn && styles.kpiWarn]}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  kpis: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  kpi: {
    flex: 1,
    backgroundColor: C.surface,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  kpiWarn: { borderColor: "#F0854D66", backgroundColor: "#F0854D14" },
  kpiValue: { color: C.fg, fontSize: 20, fontWeight: "800" },
  kpiLabel: { color: C.subtle, fontSize: 11, marginTop: 2 },
  health: {
    color: C.subtle,
    fontSize: 11,
    fontFamily: "monospace",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  error: { color: C.danger, fontSize: 12, paddingHorizontal: 16, marginTop: 8 },
});
