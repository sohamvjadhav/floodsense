import Svg, { Path, Circle as SvgCircle } from "react-native-svg";
import { pct } from "../theme";

export default function RiskGauge({ p, color }: { p: number; color: string }) {
  const r = 52;
  const cx = 70;
  const cy = 62;
  const a = Math.PI * (1 - Math.min(1, Math.max(0, p)));
  const x = cx + r * Math.cos(a);
  const y = cy - r * Math.sin(a);
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const val = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x} ${y}`;
  return (
    <Svg width={140} height={80} viewBox="0 0 140 80">
      <Path d={arc} stroke="#1F2733" strokeWidth={11} fill="none" strokeLinecap="round" />
      <Path d={val} stroke={color} strokeWidth={11} fill="none" strokeLinecap="round" />
      <SvgCircle cx={x} cy={y} r={5.5} fill={color} stroke="#11151D" strokeWidth={2.5} />
    </Svg>
  );
}

export function GaugeLabel({ p }: { p: number }) {
  return pct(p, 0);
}
