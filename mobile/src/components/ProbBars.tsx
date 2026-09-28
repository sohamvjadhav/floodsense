import { View, Text, StyleSheet } from "react-native";
import { TIER_HEX, C, pct } from "../theme";
import TierBadge from "./TierBadge";

export default function ProbBars({
  probs,
}: {
  probs: { label: string; p: number; tier: number }[];
}) {
  return (
    <View style={styles.wrap}>
      {probs.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <View style={styles.track}>
            <View
              style={{
                width: `${Math.max(2, Math.min(100, row.p * 100))}%`,
                height: "100%",
                borderRadius: 999,
                backgroundColor: TIER_HEX[row.tier],
              }}
            />
          </View>
          <Text style={[styles.val, { color: TIER_HEX[row.tier] }]}>
            {pct(row.p, 1)}
          </Text>
          <TierBadge tier={row.tier} small />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { color: C.muted, fontSize: 12, width: 44 },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: C.surface3,
    overflow: "hidden",
  },
  val: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
    width: 52,
    textAlign: "right",
  },
});
