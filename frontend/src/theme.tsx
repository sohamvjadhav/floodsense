import {
  createContext, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "light", toggle: () => {} });

const stored = (): Theme | null => {
  try {
    const v = localStorage.getItem("floodsense-theme");
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
};

const system = (): Theme =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(stored() ?? system());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("floodsense-theme", theme); } catch { /* private mode */ }
  }, [theme]);

  const value = useMemo(
    () => ({ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/** Concrete colors for Recharts, which can't read CSS variables. */
export function useChartTheme() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return {
    dark,
    axis: dark ? "#7E8896" : "#6B7280",
    grid: dark ? "#1F2733" : "#E7E4DC",
    tooltipBg: dark ? "#11151D" : "#FFFFFF",
    tooltipBorder: dark ? "#2A3445" : "#E7E4DC",
    tooltipFg: dark ? "#E7ECF2" : "#0E1116",
  };
}

/** CSS band class per tier (see .band-* in index.css). */
export const TIER_BAND = ["band-low", "band-medium", "band-high", "band-severe"] as const;

/** Map-tier hex values for Leaflet markers, per theme. */
export const tierHex = (dark: boolean) =>
  dark
    ? ["#5BC982", "#E0A93C", "#F0854D", "#F26666"]
    : ["#1E8A4A", "#B97A0A", "#C2410C", "#D63B3B"];

export const pct = (p: number, digits = 1) =>
  `${(p * 100).toFixed(digits)}%`;
