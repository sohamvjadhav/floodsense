import type { DistrictRisk } from "../api";
import { tierHex, useTheme } from "../theme";
import type { Horizon } from "../horizon";

const TIER_LABEL = ["Low", "Medium", "High", "Severe"];
const BAND = ["band-low", "band-medium", "band-high", "band-severe"];

export default function DistrictList({
  districts, selected, onSelect, horizon,
}: {
  districts: DistrictRisk[];
  selected: string | null;
  onSelect: (d: string) => void;
  horizon: Horizon;
}) {
  const { theme } = useTheme();
  const hex = tierHex(theme === "dark");
  const idx = horizon / 24 - 1;
  const ranked = [...districts].sort(
    (a, b) => b.tiers[idx] - a.tiers[idx] || b.p24 - a.p24 || a.district.localeCompare(b.district),
  );

  return (
    <div className="panel !p-0 overflow-hidden anim-in">
      <div className="panel-head !mb-0 px-4 pt-3.5 pb-2">
        <div>
          <h3>Risk queue</h3>
          <p className="panel-sub">{districts.length} districts · ranked at +{horizon}h</p>
        </div>
        <span className="chip">monitored</span>
      </div>
      <div className="table-wrap border-t border-line">
        <table className="risk-queue">
          <thead>
            <tr>
              <th></th>
              <th>District</th>
              <th>Tier</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((d, i) => {
              const tier = d.tiers[idx];
              const p = [d.p24, d.p48, d.p72][idx];
              return (
                <tr
                  key={d.station_id}
                  className={d.district === selected ? "selected" : ""}
                  onClick={() => onSelect(d.district)}
                >
                  <td className="rank">{String(i + 1).padStart(2, "0")}</td>
                  <td>
                    <div className="dist-name">{d.district}</div>
                    <div className="dist-basin">{d.basin} basin</div>
                  </td>
                  <td><span className={`band ${BAND[tier]}`}>{TIER_LABEL[tier]}</span></td>
                  <td className="risk">
                    <span className="score-bar">
                      <span className="score-bar-track">
                        <span
                          className="score-bar-fill"
                          style={{ width: `${Math.min(100, Math.round(p * 100))}%`, background: hex[tier] }}
                        />
                      </span>
                      <span className="score-bar-val">{(p * 100).toFixed(0)}%</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
