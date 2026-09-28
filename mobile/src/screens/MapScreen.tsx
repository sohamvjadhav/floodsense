import { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import MapView, { Circle, Marker, Region } from "react-native-maps";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useRiskMap } from "../hooks/useRiskMap";
import { TIER_HEX, TIER_LABEL, C } from "../theme";
import type { RootStackParamList } from "../../App";

const INITIAL_REGION: Region = {
  latitude: 18.9,
  longitude: 75.6,
  latitudeDelta: 7.5,
  longitudeDelta: 7.5,
};

export default function MapScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const { districts, loading, error, refresh } = useRiskMap();
  const [horizonIdx, setHorizonIdx] = useState(0);

  return (
    <View style={styles.root}>
      {districts.length === 0 ? (
        <View style={styles.center}>
          {error ? (
            <Text style={styles.error}>API offline — pull to retry on Districts tab</Text>
          ) : (
            <ActivityIndicator color={C.accent} />
          )}
        </View>
      ) : (
        <>
          <MapView
            style={{ flex: 1 }}
            initialRegion={INITIAL_REGION}
            onRegionChangeComplete={() => {}}
          >
            {districts.map((d) => {
              const tier = d.tiers[horizonIdx];
              return (
                <View key={d.station_id}>
                  <Circle
                    center={{ latitude: d.lat, longitude: d.lon }}
                    radius={24000}
                    strokeWidth={tier >= 2 ? 2 : 1}
                    strokeColor="#FFFFFF"
                    fillColor={`${TIER_HEX[tier]}88`}
                  />
                  <Marker
                    coordinate={{ latitude: d.lat, longitude: d.lon }}
                    opacity={0}
                    onPress={() =>
                      navigation.navigate("District", { district: d.district })
                    }
                  />
                </View>
              );
            })}
          </MapView>

          <View style={styles.horizons}>
            {[24, 48, 72].map((h, i) => (
              <Text
                key={h}
                onPress={() => setHorizonIdx(i)}
                style={[styles.hBtn, horizonIdx === i && styles.hBtnActive]}
              >
                +{h}h
              </Text>
            ))}
          </View>

          <View style={styles.legend}>
            <Text style={styles.legendTitle}>Risk at +{[24, 48, 72][horizonIdx]}h</Text>
            {TIER_LABEL.map((name, i) => (
              <View key={name} style={styles.legendRow}>
                <View style={[styles.dot, { backgroundColor: TIER_HEX[i] }]} />
                <Text style={styles.legendText}>{name}</Text>
              </View>
            ))}
            <Text style={styles.legendHint} onPress={refresh}>
              tap circle → case file
            </Text>
          </View>

          {loading && (
            <View style={styles.loading}>
              <ActivityIndicator color={C.accent} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: C.danger, fontSize: 13 },
  horizons: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    flexDirection: "row",
    backgroundColor: `${C.surface}F0`,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 999,
    overflow: "hidden",
  },
  hBtn: {
    color: C.muted,
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  hBtnActive: { color: "#fff", backgroundColor: C.accent },
  legend: {
    position: "absolute",
    left: 12,
    bottom: 16,
    backgroundColor: `${C.surface}F0`,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 4,
  },
  legendTitle: {
    color: C.subtle,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: C.muted, fontSize: 12 },
  legendHint: { color: C.subtle, fontSize: 10, marginTop: 4 },
  loading: { position: "absolute", top: 60, right: 16 },
});
