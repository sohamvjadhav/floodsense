import { useEffect, useState } from "react";
import {
  CircleMarker, MapContainer, Popup, ScaleControl, TileLayer, Tooltip, ZoomControl,
  useMap,
} from "react-leaflet";
import type { DistrictRisk } from "../api";
import { tierHex, useTheme, pct } from "../theme";
import type { Horizon } from "../horizon";

const CENTER: [number, number] = [18.3, 75.4];

/* Basemaps. Satellite is default (Esri World Imagery, free, no key) with a
   Carto labels overlay on top — raw imagery has no place names. Vector
   light/dark (Carto) stay available for a quieter look. */
type BaseKey = "satellite" | "light" | "dark";

const BASEMAPS: Record<BaseKey, { label: string; url: string; attribution: string }> = {
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  },
  light: {
    label: "Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  dark: {
    label: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

const LABELS = {
  light: "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
};

const TIER_LABEL = ["Low", "Medium", "High", "Severe"];

/** Leaflet computes its size once at init; re-measure after layout settles
 *  (font load, grid column resolution) so a 0-width mount doesn't stick. */
function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const t1 = window.setTimeout(() => map.invalidateSize(), 150);
    const t2 = window.setTimeout(() => map.invalidateSize(), 500);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [map]);
  return null;
}

function BasemapSwitcher({
  value, onChange,
}: {
  value: BaseKey;
  onChange: (b: BaseKey) => void;
}) {
  return (
    <div className="absolute right-3 top-3 z-[1000]">
      <div
        role="tablist"
        aria-label="Basemap style"
        className="flex items-center gap-0.5 rounded-full border border-line bg-surface/95
                   p-1 shadow-md backdrop-blur"
      >
        {(Object.keys(BASEMAPS) as BaseKey[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={value === k}
            onClick={() => onChange(k)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors
                        focus-visible:outline-none focus-visible:ring-2
                        focus-visible:ring-accent/60
                        ${value === k
                          ? "bg-accent text-accent-fg"
                          : "text-fg-muted hover:text-fg"}`}
          >
            {BASEMAPS[k].label}
          </button>
        ))}
      </div>
    </div>
  );
}

function HorizonScrubber({
  horizon, onChange,
}: {
  horizon: Horizon;
  onChange: (h: Horizon) => void;
}) {
  return (
    <div className="absolute left-1/2 top-3 z-[1000] -translate-x-1/2">
      <div
        role="tablist"
        aria-label="Forecast horizon"
        className="flex items-center gap-0.5 rounded-full border border-line
                   bg-surface/95 p-1 shadow-md backdrop-blur"
      >
        {[24, 48, 72].map((h) => (
          <button
            key={h}
            role="tab"
            aria-selected={horizon === h}
            onClick={() => onChange(h as Horizon)}
            className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors
                        focus-visible:outline-none focus-visible:ring-2
                        focus-visible:ring-accent/60
                        ${horizon === h
                          ? "bg-accent text-accent-fg"
                          : "text-fg-muted hover:text-fg"}`}
          >
            +{h}h
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MapView({
  districts, selected, onSelect, horizon, onHorizonChange,
}: {
  districts: DistrictRisk[];
  selected: string | null;
  onSelect: (d: string) => void;
  horizon: Horizon;
  onHorizonChange: (h: Horizon) => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [base, setBase] = useState<BaseKey>("satellite");
  const hex = tierHex(dark);
  const idx = horizon / 24 - 1;

  // markers need strong contrast against satellite imagery: add a dark
  // halo stroke under the tier-colored stroke
  const showLabels = base === "satellite";

  return (
    <div className="relative h-[480px] overflow-hidden rounded-xl border border-line
                    lg:h-full lg:min-h-[560px]">
      <MapContainer
        center={CENTER}
        zoom={6.4}
        scrollWheelZoom
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer key={base} attribution={BASEMAPS[base].attribution} url={BASEMAPS[base].url} />
        {showLabels && (
          <TileLayer
            key={`labels-${theme}`}
            attribution=""
            url={LABELS[dark ? "dark" : "light"]}
            opacity={0.9}
          />
        )}
        <ZoomControl position="bottomright" />
        <ScaleControl position="bottomright" imperial={false} />
        <InvalidateOnMount />

        {districts.map((d) => {
          const tier = d.tiers[idx];
          const alerting = tier >= 2;
          const isSel = d.district === selected;
          return (
            <CircleMarker
              key={d.station_id}
              center={[d.lat, d.lon]}
              radius={9 + tier * 2.5}
              pathOptions={{
                color: isSel ? "#FFFFFF" : hex[tier],
                weight: isSel ? 2.5 : base === "satellite" ? 2 : 1.5,
                className: alerting ? "marker-pulse" : undefined,
                fillColor: hex[tier],
                fillOpacity: isSel ? 0.8 : 0.55,
              }}
              eventHandlers={{ click: () => onSelect(d.district) }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <span className="font-semibold">{d.district}</span>
                <span className="text-fg-subtle"> · {TIER_LABEL[tier]}</span>
              </Tooltip>
              <Popup>
                <div className="min-w-[200px] font-sans">
                  <p className="font-display text-sm font-semibold">{d.district}</p>
                  <p className="text-[11px] uppercase tracking-wide text-fg-subtle">
                    {d.basin} basin · pop {compactIn(d.population)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: hex[tier] }} />
                    <span className="text-sm font-semibold" style={{ color: hex[tier] }}>
                      {TIER_LABEL[tier]}
                    </span>
                    <span className="mono text-[10px] text-fg-subtle">at +{horizon}h</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    {[["+24h", d.p24], ["+48h", d.p48], ["+72h", d.p72]].map(([h, p]) => (
                      <div key={h as string} className="rounded-md bg-surface-2 px-1.5 py-1">
                        <p className="text-[10px] font-medium text-fg-subtle">{h}</p>
                        <p className="mono text-xs font-semibold">{pct(p as number, 0)}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => onSelect(d.district)}
                    className="btn btn-primary mt-2.5 w-full justify-center !py-1.5 text-xs"
                  >
                    Open case file →
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <HorizonScrubber horizon={horizon} onChange={onHorizonChange} />
      <BasemapSwitcher value={base} onChange={setBase} />

      {/* legend overlay */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500]
                      rounded-xl border border-line bg-surface/90 px-3 py-2.5
                      shadow-sm backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
          Risk at +{horizon}h
        </p>
        <div className="mt-1.5 space-y-1">
          {TIER_LABEL.map((name, i) => (
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

const inr = new Intl.NumberFormat("en-IN", { notation: "compact", compactDisplay: "short" });
const compactIn = (n: number) => inr.format(n);
