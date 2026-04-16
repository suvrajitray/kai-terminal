import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { exitAll, exitByFilter } from '../services/trading';
import { useBrokerStore } from '../stores/broker-store';
import { BROKERS } from '../constants';
import type { LivePosition } from '../hooks/use-live-positions';

export function ExitBar({ positions, onRefresh }: { positions: LivePosition[]; onRefresh: () => void }) {
  const [acting, setActing] = useState<string | null>(null);
  const isAuthenticated = useBrokerStore((s) => s.isAuthenticated);
  const connectedBrokers = BROKERS.filter((b) => isAuthenticated(b.id)).map((b) => b.id);

  const profitable = positions.filter((p) => p.pnl > 0 && p.quantity !== 0);
  const loss       = positions.filter((p) => p.pnl < 0 && p.quantity !== 0);

  const act = async (key: string, fn: () => Promise<void>) => {
    setActing(key);
    try { await fn(); await onRefresh(); } catch { /* toast */ } finally { setActing(null); }
  };

  const confirmExitAll = () =>
    Alert.alert('Exit All', 'This will exit ALL open positions. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Exit All', style: 'destructive', onPress: () => act('all', () => exitAll(connectedBrokers)) },
    ]);

  return (
    <View className="flex-row gap-2 mx-4 mb-3">
      <TouchableOpacity disabled={!!acting} onPress={confirmExitAll}
        className="flex-1 bg-rose-500/20 border border-rose-500/40 py-2.5 rounded-xl items-center">
        <Text className="text-rose-400 text-xs font-bold">Exit All</Text>
      </TouchableOpacity>
      <TouchableOpacity disabled={!!acting || profitable.length === 0}
        onPress={() => act('profitable', () => exitByFilter(positions, 'profitable'))}
        className="flex-1 bg-emerald-500/10 border border-emerald-500/30 py-2.5 rounded-xl items-center">
        <Text className="text-emerald-400 text-xs font-bold">Profitable ({profitable.length})</Text>
      </TouchableOpacity>
      <TouchableOpacity disabled={!!acting || loss.length === 0}
        onPress={() => act('loss', () => exitByFilter(positions, 'loss'))}
        className="flex-1 bg-rose-500/10 border border-rose-500/30 py-2.5 rounded-xl items-center">
        <Text className="text-rose-400 text-xs font-bold">Loss ({loss.length})</Text>
      </TouchableOpacity>
    </View>
  );
}
