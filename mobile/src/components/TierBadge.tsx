import { View, Text, StyleSheet } from "react-native";
import { TIER_HEX, TIER_LABEL } from "../theme";

export default function TierBadge({
  tier,
  small,
}: {
  tier: number;
  small?: boolean;
}) {
  return (
    <View
      style={[
        styles.badge,
        small && styles.small,
        { backgroundColor: `${TIER_HEX[tier]}22`, borderColor: TIER_HEX[tier] },
      ]}
    >
      <Text style={[styles.text, small && styles.smallText, { color: TIER_HEX[tier] }]}>
        {TIER_LABEL[tier]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  small: { paddingHorizontal: 6, paddingVertical: 2 },
  text: { fontSize: 11, fontWeight: "700" },
  smallText: { fontSize: 10 },
});
