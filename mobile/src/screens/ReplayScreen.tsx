import { useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  fetchReplayEvents, fetchReplayRange,
} from "../api/endpoints";
import type { ReplayEvent, ReplayFrame } from "../api/types";
import {
  TIER_HEX, TIER_LABEL, TIER_OPERATOR_ACTION, C, pct, compactIn,
} from "../theme";

interface DayStat {
  date: string;
  worst: number;
  nAlerting: number;
  pop: number;
  eventDay: boolean;
  maxP24: number;
}

export default function ReplayScreen() {
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [frames, setFrames] = useState<ReplayFrame[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchReplayEvents().then((e) => setEvents(e.events)).catch(() => {});
  }, []);

  const load = (evDate: string) => {
    setBusy(true);
    setErr(null);
    const start = new Date(evDate);
    start.setDate(start.getDate() - 6);
    fetchReplayRange(start.toISOString().slice(0, 10), 10)
      .then((r) => {
        setFrames(r.frames);
        setIdx(0);
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setBusy(false));
  };

  const stats: DayStat[] = useMemo(
    () =>
      (frames ?? []).map((f) => {
        const alerting = f.districts.filter((d) => d.tiers[0] >= 2);
        return {
          date: f.date,
          worst: f.districts.reduce((m, d) => Math.max(m, d.tiers[0]), 0),
          nAlerting: alerting.length,
          pop: alerting.reduce((s, d) => s + d.population, 0),
          eventDay: f.districts.some((d) => d.flood_label === 1),
          maxP24: f.districts.reduce((m, d) => Math.max(m, d.p24), 0),
        };
      }),
    [frames],
  );

  const firstAlert = stats.findIndex((s) => s.worst >= 2);
  const firstEvent = stats.findIndex((s) => s.eventDay);
  const leadDays =
    firstAlert >= 0 && firstEvent >= 0 ? firstEvent - firstAlert : null;

  const cur = stats[idx];

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                 contentContainerStyle={styles.eventChips}>
        {events.map((ev) => (
          <Pressable key={ev.date} style={styles.chip} onPress={() => load(ev.date)}>
            <Text style={styles.chipName}>{ev.name}</Text>
            <Text style={styles.chipDate}>{ev.date.slice(5)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {busy && <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} />}
      {err && <Text style={styles.error}>{err}</Text>}

      {!busy && frames && cur && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          <View style={styles.brief}>
            <Text style={styles.briefTitle}>
              Operator briefing · {cur.date}
            </Text>
            <Text style={styles.briefBody}>
              <View style={[styles.dot, { backgroundColor: TIER_HEX[cur.worst] }]} />{" "}
              <Text style={{ fontWeight: "700" }}>{TIER_LABEL[cur.worst]}</Text>{" "}
              statewide peak · {cur.nAlerting} district{cur.nAlerting === 1 ? "" : "s"}{" "}
              at High+ · {compactIn(cur.pop)} residents in monitored high-risk districts
            </Text>
            <View style={styles.action}>
              <Text style={styles.actionTitle}>Suggested action</Text>
              <Text style={styles.actionBody}>
                {TIER_OPERATOR_ACTION[cur.worst]}
              </Text>
            </View>
          </View>

          <View>
            <Text style={styles.sectionTitle}>Peak 24h risk by day</Text>
            <View style={styles.traj}>
              {stats.map((s, i) => (
                <View key={s.date} style={styles.trajCol}>
                  <View style={styles.trajBarWrap}>
                    <View
                      style={[
                        styles.trajBar,
                        {
                          height: `${Math.max(3, s.maxP24 * 100)}%`,
                          backgroundColor:
                            i <= idx ? C.teal : `${C.teal}44`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.trajDay}>{s.date.slice(8)}</Text>
                </View>
              ))}
            </View>
          </View>

          <View>
            <Text style={styles.sectionTitle}>Decision timeline — tap a day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.days}>
                {stats.map((s, i) => (
                  <Pressable
                    key={s.date}
                    onPress={() => setIdx(i)}
                    style={[styles.dayCell, i === idx && styles.dayActive]}
                  >
                    <Text style={styles.dayDate}>{s.date.slice(5)}</Text>
                    <View style={[styles.dayTier, { backgroundColor: TIER_HEX[s.worst] }]} />
                    <Text style={styles.dayMarks}>
                      {firstAlert === i ? "▲" : ""}
                      {firstEvent === i ? "●" : ""}
                      {firstAlert !== i && firstEvent !== i
                        ? s.nAlerting > 0
                          ? String(s.nAlerting)
                          : "·"
                        : ""}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <View style={styles.marksLegend}>
              <Text style={styles.markA}>▲ first High-tier alert   </Text>
              <Text style={styles.markE}>● observed event onset</Text>
            </View>
          </View>

          {firstEvent >= 0 && (
            <View
              style={[
                styles.verdict,
                leadDays == null && styles.verdictNeutral,
                leadDays !== null && leadDays > 0 && styles.verdictGood,
                leadDays === 0 && styles.verdictWarn,
                leadDays !== null && leadDays < 0 && styles.verdictBad,
              ]}
            >
              {leadDays == null ? (
                <Text style={styles.verdictText}>
                  No High-tier alert was raised in this window before the observed event.
                </Text>
              ) : leadDays > 0 ? (
                <Text style={styles.verdictText}>
                  <Text style={{ color: C.teal, fontWeight: "800" }}>
                    Useful lead time: ~{leadDays * 24}h
                  </Text>{" "}
                  — FloodSense crossed High tier {leadDays} day
                  {leadDays === 1 ? "" : "s"} before the observed event.
                </Text>
              ) : leadDays === 0 ? (
                <Text style={styles.verdictText}>
                  <Text style={{ color: "#E0A93C", fontWeight: "800" }}>
                    Same-day flag.
                  </Text>{" "}
                  The alert fired on the event day — no actionable lead time here.
                </Text>
              ) : (
                <Text style={styles.verdictText}>
                  <Text style={{ color: C.danger, fontWeight: "800" }}>
                    Missed early warning.
                  </Text>{" "}
                  Alert came {-leadDays} day{leadDays === -1 ? "" : "s"} after onset.
                </Text>
              )}
            </View>
          )}

          <Text style={styles.footnote}>
            Replay uses only information available on each day — the model window
            never sees future rainfall. Event onset is overlaid afterwards for
            comparison. Peak risk shown: {pct(cur.maxP24, 1)}.
          </Text>
        </ScrollView>
      )}

      {!busy && !frames && !err && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Historical event replay</Text>
          <Text style={styles.emptyBody}>
            Pick an event above to step through the days before a documented
            flood — watch upstream rainfall raise district risk before the
            observed onset, and see the estimated warning lead time.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  eventChips: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    backgroundColor: C.surface,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipName: { color: C.fg, fontSize: 13, fontWeight: "600" },
  chipDate: { color: C.subtle, fontSize: 11, fontFamily: "monospace", marginTop: 2 },
  error: { color: C.danger, fontSize: 12, paddingHorizontal: 16 },
  brief: {
    backgroundColor: C.surface2,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  briefTitle: {
    color: C.subtle, fontSize: 10, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  briefBody: { color: C.fg, fontSize: 13.5, lineHeight: 20 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  action: {
    backgroundColor: C.bg, borderColor: C.line, borderWidth: 1,
    borderRadius: 12, padding: 10,
  },
  actionTitle: {
    color: C.subtle, fontSize: 10, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  actionBody: { color: C.muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
  sectionTitle: {
    color: C.subtle, fontSize: 11, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8,
  },
  traj: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 90 },
  trajCol: { flex: 1, alignItems: "center", gap: 4 },
  trajBarWrap: {
    height: 70, width: "100%",
    justifyContent: "flex-end",
  },
  trajBar: { width: "100%", borderRadius: 4 },
  trajDay: { color: C.subtle, fontSize: 9, fontFamily: "monospace" },
  days: { flexDirection: "row", gap: 6 },
  dayCell: {
    minWidth: 56, alignItems: "center", gap: 5,
    backgroundColor: C.surface, borderColor: C.line, borderWidth: 1,
    borderRadius: 12, paddingVertical: 8, paddingHorizontal: 6,
  },
  dayActive: { borderColor: C.accent, backgroundColor: C.surface3 },
  dayDate: { color: C.subtle, fontSize: 10, fontFamily: "monospace" },
  dayTier: { height: 6, width: "80%", borderRadius: 999 },
  dayMarks: { color: C.fg, fontSize: 10, minHeight: 12 },
  marksLegend: { flexDirection: "row", marginTop: 6 },
  markA: { color: TIER_HEX[2], fontSize: 10 },
  markE: { color: TIER_HEX[3], fontSize: 10 },
  verdict: {
    borderRadius: 14, borderWidth: 1, padding: 12,
    borderColor: `${C.teal}55`, backgroundColor: `${C.teal}14`,
  },
  verdictNeutral: { borderColor: C.line, backgroundColor: C.surface2 },
  verdictGood: { borderColor: `${C.teal}55`, backgroundColor: `${C.teal}14` },
  verdictWarn: { borderColor: "#E0A93C55", backgroundColor: "#E0A93C14" },
  verdictBad: { borderColor: `${C.danger}55`, backgroundColor: `${C.danger}14` },
  verdictText: { color: C.fg, fontSize: 13, lineHeight: 19 },
  footnote: { color: C.subtle, fontSize: 11, lineHeight: 15 },
  empty: { padding: 24, gap: 8 },
  emptyTitle: { color: C.fg, fontSize: 18, fontWeight: "700" },
  emptyBody: { color: C.muted, fontSize: 13, lineHeight: 19 },
});
