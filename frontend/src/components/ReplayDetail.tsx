import type { DistrictRisk } from "../api";
import { tierHex, useTheme } from "../theme";

const TIER_LABEL = ["Low", "Medium", "High", "Severe"];
const BAND = ["band-low", "band-medium", "band-high", "band-severe"];

/** Case-file panel for historical replay: what the model said for this
 *  district as of the replay date, and what actually fell from the sky. */
export default function ReplayDetail({
  d, onClose,
}: {
  d: DistrictRisk;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const hex = tierHex(theme === "dark");
  const t = d.tiers[0];

  return (
    <div className="panel anim-in">
      <div className="case-header">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="case-id truncate">{d.district}</h2>
            <button onClick={onClose} aria-label="Close replay details"
                    className="icon-btn ml-auto shrink-0">×</button>
          </div>
          <div className="case-tags">
            <span className="chip">{d.basin} basin</span>
            <span className={`band ${BAND[t]}`}>{TIER_LABEL[t]}</span>
            <span className="chip mono">replay · {d.as_of}</span>
          </div>
        </div>
      </div>

      <div className="kv">
        <div className="kv-row"><span className="k">risk +24h</span>
          <span className="v" style={{ color: hex[d.tiers[0]] }}>{pct1(d.p24)}</span></div>
        <div className="kv-row"><span className="k">risk +48h</span>
          <span className="v" style={{ color: hex[d.tiers[1]] }}>{pct1(d.p48)}</span></div>
        <div className="kv-row"><span className="k">risk +72h</span>
          <span className="v" style={{ color: hex[d.tiers[2]] }}>{pct1(d.p72)}</span></div>
        <div className="kv-row"><span className="k">population</span>
          <span className="v">{compact(d.population)}</span></div>
        <div className="kv-row"><span className="k">rainfall 24h</span>
          <span className="v">{d.rainfall_24h ?? "—"} mm</span></div>
        <div className="kv-row"><span className="k">rainfall 3d</span>
          <span className="v">{d.rain_3d_mm ?? "—"} mm</span></div>
        <div className="kv-row"><span className="k">rainfall 7d</span>
          <span className="v">{d.rain_7d_mm ?? "—"} mm</span></div>
        <div className="kv-row"><span className="k">flood-label day</span>
          <span className="v">{d.flood_label === 1 ? "yes" : "no"}</span></div>
      </div>

      <p className="explain-text !mt-4">
        The model saw <strong>only the 7 days before {d.as_of}</strong> —
        no future rainfall. {(d.flood_label === 1)
          ? "This was a flood-label day: the risk above is a genuine lead-time call, not hindsight."
          : "No flood label on this day; elevated risk here reflects antecedent conditions upstream."}
      </p>
    </div>
  );
}

const inr = new Intl.NumberFormat("en-IN", { notation: "compact", compactDisplay: "short" });
const compact = (n: number) => inr.format(n);
const pct1 = (p: number) => `${(p * 100).toFixed(1)}%`;
