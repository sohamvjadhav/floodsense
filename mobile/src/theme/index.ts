export const C = {
  bg: "#0B0E13",
  surface: "#11151D",
  surface2: "#161C26",
  surface3: "#1F2733",
  line: "#2A3445",
  fg: "#E7ECF2",
  muted: "#9AA5B4",
  subtle: "#6B7686",
  accent: "#3FA9F5",
  violet: "#8B7CF6",
  teal: "#3FD4BC",
  danger: "#F26666",
};

export const TIER_HEX = ["#5BC982", "#E0A93C", "#F0854D", "#F26666"];

export const TIER_LABEL = ["Low", "Medium", "High", "Severe"];

export const TIER_GUIDANCE = [
  "No action needed — conditions are within normal range.",
  "Monitor updates; avoid waterlogged routes and riverbank walks.",
  "Prepare: move vehicles and valuables to higher ground; stay clear of rivers.",
  "EVACUATE low-lying areas now and follow official instructions.",
];

export const TIER_OPERATOR_ACTION = [
  "Routine monitoring — no escalation needed.",
  "Increase monitoring frequency; verify local rain gauges.",
  "Notify district control room; pre-position response resources.",
  "Escalate to emergency protocols; verify low-lying settlements.",
];

export const NAV_THEME = {
  dark: true,
  colors: {
    primary: C.accent,
    background: C.bg,
    card: C.surface,
    text: C.fg,
    border: C.line,
    notification: C.danger,
  },
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" as const },
    medium: { fontFamily: "System", fontWeight: "500" as const },
    bold: { fontFamily: "System", fontWeight: "700" as const },
    heavy: { fontFamily: "System", fontWeight: "900" as const },
  },
};

export const pct = (p: number, digits = 1) => `${(p * 100).toFixed(digits)}%`;

export const compactIn = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    notation: "compact",
    compactDisplay: "short",
  }).format(n);
