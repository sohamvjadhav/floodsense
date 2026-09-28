import { useState } from "react";
import {
  View, Text, TextInput, ScrollView, Pressable, StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribe, unsubscribe } from "../api/endpoints";
import { useRiskMap } from "../hooks/useRiskMap";
import { C } from "../theme";

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const { districts } = useRiskMap();
  const [mode, setMode] = useState<"sub" | "unsub">("sub");
  const [phone, setPhone] = useState("+91");
  const [district, setDistrict] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const submit = async () => {
    if (!district) return;
    setBusy(true);
    setStatus(null);
    try {
      const fn = mode === "sub" ? subscribe : unsubscribe;
      await fn(phone.trim(), district);
      setStatus({
        ok: true,
        msg:
          mode === "sub"
            ? `Subscribed to ${district}. New numbers: send the sandbox join code to +1 415 523 8886 on WhatsApp once to activate delivery.`
            : `Unsubscribed from ${district}. You will no longer receive alerts.`,
      });
    } catch (e) {
      setStatus({ ok: false, msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setMode("sub")}
            style={[styles.modeBtn, mode === "sub" && styles.modeActive]}
          >
            <Text style={[styles.modeText, mode === "sub" && styles.modeTextActive]}>
              Opt in
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("unsub")}
            style={[styles.modeBtn, mode === "unsub" && styles.modeOut]}
          >
            <Text style={[styles.modeText, mode === "unsub" && styles.modeTextActive]}>
              Opt out
            </Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>WhatsApp number</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+919812345678"
            placeholderTextColor={C.subtle}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>

        <View>
          <Text style={styles.label}>District</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
                     style={{ marginTop: 8 }}>
            <View style={styles.chips}>
              {districts.map((d) => (
                <Pressable
                  key={d.station_id}
                  onPress={() => setDistrict(d.district)}
                  style={[styles.chip, district === d.district && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      district === d.district && styles.chipTextActive,
                    ]}
                  >
                    {d.district}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <Pressable
          onPress={submit}
          disabled={busy || !district}
          style={[styles.submit, (!district || busy) && { opacity: 0.5 }]}
        >
          <Text style={styles.submitText}>
            {busy ? "…" : mode === "sub" ? "Subscribe" : "Unsubscribe"}
          </Text>
        </Pressable>

        {status && (
          <Text
            style={[styles.status, { color: status.ok ? C.teal : C.danger }]}
          >
            {status.msg}
          </Text>
        )}

        <Text style={styles.note}>
          Alerts are a controlled prototype. Every message is labeled as a
          simulated warning — never an official emergency instruction.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  modeRow: {
    flexDirection: "row", backgroundColor: C.surface,
    borderColor: C.line, borderWidth: 1, borderRadius: 999, padding: 3,
  },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: "center" },
  modeActive: { backgroundColor: "#5BC98222" },
  modeOut: { backgroundColor: "#F2666622" },
  modeText: { color: C.muted, fontSize: 13, fontWeight: "600" },
  modeTextActive: { color: C.fg },
  field: { gap: 6 },
  label: {
    color: C.subtle, fontSize: 11, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  input: {
    backgroundColor: C.surface, borderColor: C.line, borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    color: C.fg, fontFamily: "monospace", fontSize: 15,
  },
  chips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip: {
    borderColor: C.line, borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.surface,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.muted, fontSize: 12 },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  submit: {
    backgroundColor: C.accent, borderRadius: 12, paddingVertical: 13,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  status: { fontSize: 13, lineHeight: 18 },
  note: { color: C.subtle, fontSize: 11, lineHeight: 15 },
});
