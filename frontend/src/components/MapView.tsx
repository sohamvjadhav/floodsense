import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import type { DistrictRisk } from "../api";

const MAHARASHTRA_CENTER: [number, number] = [18.6, 75.5];

export default function MapView({
  districts, selected, onSelect,
}: {
  districts: DistrictRisk[];
  selected: string | null;
  onSelect: (d: string) => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-800 h-[520px] lg:h-auto lg:min-h-[600px]">
      <MapContainer
        center={MAHARASHTRA_CENTER}
        zoom={6.5}
        scrollWheelZoom
        style={{ height: "100%", width: "100%", background: "#0f172a" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {districts.map((d) => (
          <CircleMarker
            key={d.station_id}
            center={[d.lat, d.lon]}
            radius={14 + d.tier * 6}
            pathOptions={{
              color: d.color,
              weight: d.district === selected ? 3 : 1.5,
              fillColor: d.color,
              fillOpacity: 0.55,
            }}
            eventHandlers={{ click: () => onSelect(d.district) }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              {d.district} — {d.tier_name}
            </Tooltip>
            <Popup>
              <div className="font-sans">
                <strong>{d.district}</strong> ({d.basin} basin)
                <br />Risk: <strong style={{ color: d.color }}>{d.tier_name}</strong>
                <br />24h: {(d.p24 * 100).toFixed(1)}% · 48h: {(d.p48 * 100).toFixed(1)}% · 72h: {(d.p72 * 100).toFixed(1)}%
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
