import type { DistrictRisk } from "../api";
import { TIER_STYLES, pct } from "../theme";

export default function DistrictList({
  districts, selected, onSelect,
}: {
  districts: DistrictRisk[];
  selected: string | null;
  onSelect: (d: string) => void;
}) {
  const ranked = [...districts].sort(
    (a, b) => b.tier - a.tier || b.p24 - a.p24 || a.district.localeCompare(b.district),
  );

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="flex items-baseline justify-between px-4 pt-3.5 pb-2">
        <h2 className="text-[13px] font-bold tracking-tight">Districts by risk</h2>
        <span className="text-[11px] text-fg-subtle">{districts.length} monitored</span>
      </div>
      <ul className="max-h-[248px] overflow-y-auto border-t border-line">
        {ranked.map((d) => {
          const s = TIER_STYLES[d.tier];
          const active = d.district === selected;
          return (
            <li key={d.station_id}>
              <button
                onClick={() => onSelect(d.district)}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-left
                            transition-colors hover:bg-surface-2
                            focus-visible:outline-none focus-visible:bg-surface-2
                            ${active ? "bg-surface-2" : ""}`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`}
                      style={d.tier >= 2 ? { boxShadow: "0 0 0 3px color-mix(in srgb, currentColor 18%, transparent)" } : undefined} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium leading-tight">
                    {d.district}
                  </span>
                  <span className="block text-[11px] leading-tight text-fg-subtle">
                    {d.basin}
                  </span>
                </span>
                <span className={`num shrink-0 text-[13px] font-semibold ${s.fg}`}>
                  {pct(d.p24, 0)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
