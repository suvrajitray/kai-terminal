import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useLivePositionsContext } from '../../hooks/use-live-positions-context';
import { useRiskConfig } from '../../hooks/use-risk-config';
import { fetchFunds } from '../../services/trading';
import { useBrokerStore } from '../../stores/broker-store';
import { BROKERS } from '../../constants';
import { MtmCard } from '../../components/MtmCard';
import { StatsRow } from '../../components/StatsRow';
import { RiskEventBanner } from '../../components/RiskEventBanner';

export default function DashboardScreen() {
  const router = useRouter();
  const { positions, connected } = useLivePositionsContext();
  const isAuthenticated = useBrokerStore((s) => s.isAuthenticated);
  const connectedBrokers = BROKERS.filter((b) => isAuthenticated(b.id));

  const upstoxCfg  = useRiskConfig('upstox');
  const zerodhaCfg = useRiskConfig('zerodha');
  const ppConfigs  = { upstox: upstoxCfg.config, zerodha: zerodhaCfg.config };

  const [margin, setMargin] = useState<Record<string, number | null>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadMargin = async () => {
    const results = await Promise.allSettled(
      connectedBrokers.map(async (b) => {
        const f = await fetchFunds(b.id);
        return [b.id, f.availableMargin] as const;
      })
    );
    const map: Record<string, number | null> = {};
    for (const r of results) if (r.status === 'fulfilled') map[r.value[0]] = r.value[1];
    setMargin(map);
  };

  useEffect(() => { loadMargin(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMargin();
    setRefreshing(false);
  };

  const openCount = positions.filter((p) => p.quantity !== 0).length;

  return (
    <ScrollView
      className="flex-1 bg-zinc-950"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7B2FF7" />}
    >
      <View className="px-4 pt-12 pb-2 flex-row items-center justify-between">
        <Text className="text-white text-xl font-bold">KAI Terminal</Text>
        <View className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
      </View>

      <MtmCard positions={positions} ppConfigs={ppConfigs} />
      <StatsRow positions={positions} margin={margin} />
      <RiskEventBanner event={null} />

      <TouchableOpacity
        className="mx-4 mt-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex-row items-center justify-between"
        onPress={() => router.push('/(tabs)/positions')}
      >
        <Text className="text-zinc-200 font-medium">Open Positions</Text>
        <Text className="text-violet-400 font-bold">{openCount}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
