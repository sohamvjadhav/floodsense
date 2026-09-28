import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable,
} from "react-native";
import type { RouteProp } from "@react-navigation/native";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Slider from "@react-native-community/slider";
import { fetchDistrict, runScenario } from "../api/endpoints";
import type { DistrictDetail, ScenarioResult } from "../api/types";
import RiskGauge from "../components/RiskGauge";
import TierBadge from "../components/TierBadge";
import ProbBars from "../components/ProbBars";
import {
  TIER_HEX, TIER_LABEL, TIER_GUIDANCE, C, pct, compactIn,
} from "../theme";
import type { RootStackParamList } from "../../App";

const PRESETS = [50, 100, 150, 200, 300];

export default function DistrictScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "District">>();
  const [data, setData] = useState<DistrictDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [whatIf, setWhatIf] = useState(100);
  const [scenario, setScenario] = useState<ScenarioResult | null>(null);
  const [scBusy, setScBusy] = useState(false);

  useEffect(() => {
    setData(null);
    setErr(null);
    fetchDistrict(route.params.district)
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, [route.params.district]);

  useEffect(() => {
    if (!data) return;
    let live = true;
    setScBusy(true);
    const t = setTimeout(() => {
      runScenario(data.station_id, whatIf)
        .then((r) => live && setScenario(r))
        .catch(() => live && setScenario(null))
        .finally(() => live && setScBusy(false));
    }, 450);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [data, whatIf]);

  if (err) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.error}>{err}</Text>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  const t = data.risk;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{data.district}</Text>
          <View style={styles.tags}>
            <Text style={styles.tag}>{data.basin} basin</Text>
            <TierBadge tier={t.tier24} />
            <Text style={styles.tag}>as of {data.as_of}</Text>
          </View>
        </View>
        <RiskGauge p={t.p24} color={TIER_HEX[t.tier24]} />
      </View>

      <Text style={styles.guidance}>
        <Text style={{ fontWeight: "700" }}>What to do: </Text>
        {TIER_GUIDANCE[t.tier24]}
      </Text>

      <Card>
        <ProbBars
          probs={[
            { label: "+24h", p: t.p24, tier: t.tier24 },
            { label: "+48h", p: t.p48, tier: t.tier48 },
            { label: "+72h", p: t.p72, tier: t.tier72 },
          ]}
        />
        <Row k="Station" v={data.station_id} />
        <Row k="Updates" v={String(data.risk_history.length)} />
      </Card>

      {data.drivers && (
        <Card>
          <SectionTitle>Why this risk</SectionTitle>
          <PctBar
            label={`rain last 24h · ${data.drivers.rain_24h}mm`}
            p={data.drivers.rain_24h_pctile}
          />
          <PctBar
            label={`rain last 7 days · ${data.drivers.rain_7d_mm}mm`}
            p={data.drivers.rain_7d_pctile}
          />
          <PctBar
            label={`upstream rain, 1d ago · ${data.drivers.upstream_rain_lag1}mm`}
          />
          <PctBar
            label={`upstream rain, 2d ago · ${data.drivers.upstream_rain_lag2}mm`}
          />
          <Text style={styles.footnote}>
            Percentiles compare against the same calendar month across the
            5-year dataset.
          </Text>
        </Card>
      )}

      <Card>
        <SectionTitle>Scenario lab — hypothetical rain tomorrow</SectionTitle>
        <View style={styles.presets}>
          {PRESETS.map((mm) => (
            <Pressable
              key={mm}
              onPress={() => setWhatIf(mm)}
              style={[styles.preset, whatIf === mm && styles.presetActive]}
            >
              <Text
                style={[
                  styles.presetText,
                  whatIf === mm && styles.presetTextActive,
                ]}
              >
                {mm}mm
              </Text>
            </Pressable>
          ))}
        </View>
        <Slider
          minimumValue={0}
          maximumValue={300}
          step={10}
          value={whatIf}
          onValueChange={setWhatIf}
          minimumTrackTintColor={C.accent}
          maximumTrackTintColor={C.surface3}
          thumbTintColor={C.accent}
        />
        <Text style={styles.sliderVal}>
          {scBusy ? "…" : `${whatIf}mm`}
        </Text>
        {scenario && !scBusy && (
          <View style={styles.scGrid}>
            {(
              [
                ["+24h", scenario.baseline.tier24, scenario.scenario.tier24, scenario.scenario.p24, scenario.baseline.p24],
                ["+48h", scenario.baseline.tier48, scenario.scenario.tier48, scenario.scenario.p48, scenario.baseline.p48],
                ["+72h", scenario.baseline.tier72, scenario.scenario.tier72, scenario.scenario.p72, scenario.baseline.p72],
              ] as const
            ).map(([h, from, to, p, p0]) => {
              const dPts = Math.round((p - p0) * 100);
              const jump = to > from;
              return (
                <View
                  key={h}
                  style={[styles.scCell, jump && styles.scCellJump]}
                >
                  <Text style={styles.scH}>{h}</Text>
                  <Text style={styles.scTiers}>
                    {TIER_LABEL[from][0]} → {TIER_LABEL[to][0]}
                  </Text>
                  <Text style={styles.scP}>{pct(p, 0)}</Text>
                  {dPts !== 0 && (
                    <Text
                      style={[
                        styles.scDelta,
                        { color: dPts > 0 ? "#F0854D" : C.teal },
                      ]}
                    >
                      {dPts > 0 ? "+" : ""}
                      {dPts} pts
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
        <Text style={styles.footnote}>
          Simulated scenario — not an official forecast. Planning tool for drills.
        </Text>
      </Card>
    </ScrollView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.rowLine}>
      <Text style={styles.rowK}>{k}</Text>
      <Text style={styles.rowV}>{v}</Text>
    </View>
  );
}

function PctBar({ label, p }: { label: string; p?: number }) {
  return (
    <View style={styles.pctRow}>
      <Text style={styles.pctLabel}>{label}</Text>
      {p !== undefined ? (
        <View style={styles.pctRight}>
          <View style={styles.pctTrack}>
            <View
              style={{
                width: `${Math.min(100, p)}%`,
                height: "100%",
                borderRadius: 999,
                backgroundColor: p >= 90 ? TIER_HEX[3] : p >= 75 ? TIER_HEX[2] : TIER_HEX[0],
              }}
            />
          </View>
          <Text style={styles.pctVal}>{Math.round(p)}%</Text>
        </View>
      ) : (
        <Text style={styles.pctNA}>—</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  center: { alignItems: "center", justifyContent: "center" },
  error: { color: C.danger, fontSize: 13 },
  back: { alignSelf: "flex-start", paddingVertical: 2, paddingRight: 12 },
  backText: { color: C.accent, fontSize: 14, fontWeight: "600" },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: C.fg, fontSize: 26, fontWeight: "800" },
  tags: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  tag: {
    color: C.subtle,
    fontSize: 11,
    fontFamily: "monospace",
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  guidance: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 19,
    backgroundColor: C.surface,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  card: {
    backgroundColor: C.surface,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: C.subtle,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  rowLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopColor: C.line,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  rowK: { color: C.muted, fontSize: 13 },
  rowV: { color: C.fg, fontSize: 13, fontFamily: "monospace" },
  pctRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pctLabel: { color: C.muted, fontSize: 12, flex: 1 },
  pctRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  pctTrack: {
    width: 110,
    height: 7,
    borderRadius: 999,
    backgroundColor: C.surface3,
    overflow: "hidden",
  },
  pctVal: { color: C.fg, fontSize: 11, fontFamily: "monospace", width: 34, textAlign: "right" },
  pctNA: { color: C.subtle, width: 34, textAlign: "right" },
  footnote: { color: C.subtle, fontSize: 11, lineHeight: 15 },
  presets: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  preset: {
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  presetActive: { backgroundColor: C.accent, borderColor: C.accent },
  presetText: { color: C.muted, fontSize: 12, fontFamily: "monospace" },
  presetTextActive: { color: "#fff", fontWeight: "700" },
  sliderVal: {
    color: C.fg,
    fontFamily: "monospace",
    fontWeight: "700",
    textAlign: "right",
    fontSize: 14,
  },
  scGrid: { flexDirection: "row", gap: 8 },
  scCell: {
    flex: 1,
    backgroundColor: C.bg,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 8,
    gap: 3,
  },
  scCellJump: { borderColor: "#F0854DAA" },
  scH: { color: C.subtle, fontSize: 10, fontFamily: "monospace" },
  scTiers: { color: C.fg, fontSize: 12, fontWeight: "700" },
  scP: { color: C.muted, fontSize: 11, fontFamily: "monospace" },
  scDelta: { fontSize: 10, fontFamily: "monospace" },
});
