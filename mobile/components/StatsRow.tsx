import { View, Text } from 'react-native';
import type { LivePosition } from '../hooks/use-live-positions';

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View className="flex-1 items-center bg-zinc-900 rounded-xl border border-zinc-800 py-3">
      <Text className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">{label}</Text>
      <Text className={`font-semibold tabular-nums text-sm ${color ?? 'text-zinc-200'}`}>{value}</Text>
    </View>
  );
}

export function StatsRow({ positions, margin }: { positions: LivePosition[]; margin: Record<string, number | null> }) {
  const realized   = positions.reduce((s, p) => s + p.realised, 0);
  const unrealized = positions.reduce((s, p) => s + p.unrealised, 0);
  const totalMargin = Object.values(margin).reduce<number>((s, v) => s + (v ?? 0), 0);
  const fmt = (v: number) => `₹${Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <View className="flex-row mx-4 mt-3 gap-2">
      <Stat label="Realized"   value={fmt(realized)}   color={realized   >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
      <Stat label="Unrealized" value={fmt(unrealized)} color={unrealized >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
      <Stat label="Margin"     value={totalMargin > 0 ? fmt(totalMargin) : '—'} />
    </View>
  );
}
