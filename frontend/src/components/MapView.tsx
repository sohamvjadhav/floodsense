import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import type { DistrictRisk } from "../api";
import { tierHex, useTheme, pct } from "../theme";

const CENTER: [number, number] = [18.3, 75.4];

// CARTO basemaps: quiet cartography that recedes behind the data,
// matched to the active theme (default OSM tiles would clash in dark mode).
const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export default function MapView({
  districts, selected, onSelect,
}: {
  districts: DistrictRisk[];
  selected: string | null;
  onSelect: (d: string) => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const hex = tierHex(dark);

  return (
    <div className="relative h-[480px] overflow-hidden rounded-2xl border border-line
                    lg:h-full lg:min-h-[560px]">
      <MapContainer
        center={CENTER}
        zoom={6.4}
        scrollWheelZoom
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer key={theme} attribution={ATTRIBUTION} url={TILES[theme]} />
        {districts.map((d) => {
          const alerting = d.tier >= 2;
          return (
            <CircleMarker
              key={d.station_id}
              center={[d.lat, d.lon]}
              radius={9 + d.tier * 2.5}
              pathOptions={{
                color: hex[d.tier],
                weight: d.district === selected ? 2.5 : 1.5,
                className: alerting ? "marker-pulse" : undefined,
                fillColor: hex[d.tier],
                fillOpacity: d.district === selected ? 0.75 : 0.45,
              }}
              eventHandlers={{ click: () => onSelect(d.district) }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <span className="text-xs font-semibold">{d.district}</span>
                <span className="text-xs text-fg-muted"> · {d.tier_name}</span>
              </Tooltip>
              <Popup>
                <div className="min-w-[190px] font-sans">
                  <p className="text-sm font-bold">{d.district}</p>
                  <p className="text-[11px] uppercase tracking-wide text-fg-subtle">
                    {d.basin} basin
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: hex[d.tier] }} />
                    <span className="text-sm font-semibold"
                          style={{ color: hex[d.tier] }}>{d.tier_name}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    {[["24h", d.p24], ["48h", d.p48], ["72h", d.p72]].map(([h, p]) => (
                      <div key={h as string} className="rounded-md bg-surface-2 px-1.5 py-1">
                        <p className="text-[10px] font-medium text-fg-subtle">{h}</p>
                        <p className="num text-xs font-semibold">{pct(p as number, 0)}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => onSelect(d.district)}
                    className="mt-2.5 w-full rounded-md bg-accent px-2 py-1.5 text-xs
                               font-semibold text-accent-fg hover:opacity-90
                               focus-visible:outline-none transition-opacity"
                  >
                    View details →
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* legend overlay */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500]
                      rounded-xl border border-line bg-surface/90 px-3 py-2.5
                      backdrop-blur-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
          Risk tier
        </p>
        <div className="mt-1.5 space-y-1">
          {["Low", "Medium", "High", "Severe"].map((name, i) => (
            <div key={name} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: hex[i] }} />
              <span className="text-xs text-fg-muted">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
