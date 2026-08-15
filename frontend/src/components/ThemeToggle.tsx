import { useTheme } from "../theme";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="relative h-9 w-9 rounded-full border border-line bg-surface
                 flex items-center justify-center text-fg-muted
                 hover:text-fg hover:border-line-strong
                 focus-visible:outline-none focus-visible:ring-2
                 focus-visible:ring-accent/60 transition-colors"
    >
      {/* sun */}
      <svg className={`absolute h-[18px] w-[18px] transition-all duration-300
                       ${dark ? "scale-50 opacity-0 rotate-90" : "scale-100 opacity-100 rotate-0"}`}
           viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      {/* moon */}
      <svg className={`absolute h-[18px] w-[18px] transition-all duration-300
                       ${dark ? "scale-100 opacity-100 rotate-0" : "scale-50 opacity-0 -rotate-90"}`}
           viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    </button>
  );
}
