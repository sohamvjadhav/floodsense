import { View, Text, StyleSheet, Pressable } from "react-native";
import type { DistrictRisk } from "../api/types";
import { TIER_HEX, C, pct, compactIn } from "../theme";
import TierBadge from "./TierBadge";

export default function DistrictRow({
  d,
  rank,
  onPress,
}: {
  d: DistrictRisk;
  rank: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.rank}>{rank}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{d.district}</Text>
        <Text style={styles.sub}>
          {d.basin} · pop {compactIn(d.population)}
        </Text>
      </View>
      <View style={styles.right}>
        <TierBadge tier={d.tiers[0]} />
        <Text style={[styles.p, { color: TIER_HEX[d.tiers[0]] }]}>
          {pct(d.p24, 1)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.surface,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rank: {
    color: C.subtle,
    fontFamily: "monospace",
    fontSize: 13,
    width: 20,
  },
  name: { color: C.fg, fontSize: 15, fontWeight: "600" },
  sub: { color: C.subtle, fontSize: 11.5, marginTop: 2 },
  right: { alignItems: "flex-end", gap: 4 },
  p: { fontFamily: "monospace", fontSize: 13, fontWeight: "700" },
});
