import { ScrollView, View, Text, RefreshControl } from 'react-native';
import { useState } from 'react';
import { useLivePositionsContext } from '../../hooks/use-live-positions-context';
import { PositionCard } from '../../components/PositionCard';
import { ExitBar } from '../../components/ExitBar';

export default function PositionsScreen() {
  const { positions } = useLivePositionsContext();
  const [refreshing, setRefreshing] = useState(false);

  const open   = positions.filter((p) => p.quantity !== 0);
  const closed = positions.filter((p) => p.quantity === 0);

  const onRefresh = async () => {
    setRefreshing(true);
    // SignalR will push updated positions once the broker processes the exit.
    // Brief delay gives the server time to receive the webhook and broadcast.
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  };

  return (
    <ScrollView className="flex-1 bg-zinc-950"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7B2FF7" />}>
      <View className="px-4 pt-12 pb-3">
        <Text className="text-white text-xl font-bold">Positions</Text>
        <Text className="text-zinc-500 text-xs mt-0.5">{open.length} open · {closed.length} closed</Text>
      </View>

      <ExitBar positions={open} onRefresh={onRefresh} />

      {open.length === 0 && (
        <View className="items-center py-12">
          <Text className="text-zinc-600 text-sm">No open positions</Text>
        </View>
      )}

      {open.map((p) => (
        <PositionCard key={`${p.instrumentToken}|${p.product}|${p.broker}`} position={p} onRefresh={onRefresh} />
      ))}

      {closed.length > 0 && (
        <View className="mx-4 mt-4 mb-2">
          <Text className="text-zinc-600 text-xs uppercase tracking-wider mb-2">Closed Today</Text>
          {closed.map((p) => (
            <View key={`${p.instrumentToken}|${p.product}|${p.broker ?? 'upstox'}`}
              className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl px-4 py-3 mb-2 flex-row justify-between items-center opacity-60">
              <Text className="text-zinc-400 text-xs">{p.tradingSymbol}</Text>
              <Text className={`text-xs font-semibold ${p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{p.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
