import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { exitPosition } from '../services/trading';
import { BROKERS } from '../constants';
import type { LivePosition } from '../hooks/use-live-positions';

export function PositionCard({ position: p, onRefresh }: { position: LivePosition; onRefresh: () => void }) {
  const [exiting, setExiting] = useState(false);
  const broker = BROKERS.find((b) => b.id === p.broker);

  const handleExit = async () => {
    setExiting(true);
    try { await exitPosition(p.instrumentToken, p.product, p.broker); await onRefresh(); }
    catch { /* toast error — will be handled in later improvement */ }
    finally { setExiting(false); }
  };

  return (
    <View className="mx-4 mb-2 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-white font-semibold text-sm flex-1" numberOfLines={1}>{p.tradingSymbol}</Text>
        <View className="flex-row gap-2">
          <View className="px-2 py-0.5 rounded-full bg-zinc-800">
            <Text className="text-zinc-400 text-[10px]">{p.product}</Text>
          </View>
          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: (broker?.color ?? '#7B2FF7') + '33' }}>
            <Text className="text-[10px] font-medium" style={{ color: broker?.color }}>{broker?.name}</Text>
          </View>
        </View>
      </View>

      <View className="flex-row gap-4 mb-3">
        <Text className="text-zinc-400 text-xs">Qty <Text className={`font-semibold ${p.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{p.quantity > 0 ? '+' : ''}{p.quantity}</Text></Text>
        <Text className="text-zinc-400 text-xs">LTP <Text className="text-white">₹{p.ltp.toFixed(2)}</Text></Text>
        <Text className="text-zinc-400 text-xs">Avg <Text className="text-white">₹{p.averagePrice.toFixed(2)}</Text></Text>
      </View>

      <View className="flex-row items-center justify-between">
        <Text className={`text-base font-bold tabular-nums ${p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {p.pnl >= 0 ? '▲' : '▼'} ₹{Math.abs(p.pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
        <TouchableOpacity
          onPress={handleExit} disabled={exiting}
          className="bg-rose-500/20 border border-rose-500/40 px-4 py-1.5 rounded-lg"
        >
          {exiting
            ? <ActivityIndicator size="small" color="#f87171" />
            : <Text className="text-rose-400 text-sm font-semibold">Exit</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}
