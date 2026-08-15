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
    document.documentElement.classList.toggle("dark", theme === "dark");
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
    axis: dark ? "#5f6b80" : "#8a93a3",
    grid: dark ? "#1f2a3f" : "#e4e7ec",
    tooltipBg: dark ? "#101827" : "#ffffff",
    tooltipBorder: dark ? "#2c3a55" : "#e4e7ec",
    tooltipFg: dark ? "#e8edf5" : "#101828",
  };
}

export const TIER_STYLES = [
  { fg: "text-tier-low", dot: "bg-tier-low", soft: "bg-tier-low/10 border-tier-low/25" },
  { fg: "text-tier-medium", dot: "bg-tier-medium", soft: "bg-tier-medium/10 border-tier-medium/25" },
  { fg: "text-tier-high", dot: "bg-tier-high", soft: "bg-tier-high/10 border-tier-high/25" },
  { fg: "text-tier-severe", dot: "bg-tier-severe", soft: "bg-tier-severe/10 border-tier-severe/25" },
] as const;

/** Map-tier hex values for Leaflet markers, per theme. */
export const tierHex = (dark: boolean) =>
  dark
    ? ["#34d399", "#fbbf24", "#fb923c", "#f87171"]
    : ["#059669", "#b45309", "#ea580c", "#dc2626"];

export const pct = (p: number, digits = 1) =>
  `${(p * 100).toFixed(digits)}%`;
