import { View, Text } from 'react-native';
import { BROKERS } from '../constants';
import { useBrokerStore } from '../stores/broker-store';
import type { RiskConfig } from '../services/risk-config';
import type { LivePosition } from '../hooks/use-live-positions';

interface Props {
  positions: LivePosition[];
  ppConfigs: Record<string, RiskConfig>;
}

export function MtmCard({ positions, ppConfigs }: Props) {
  const totalMtm = positions.reduce((s, p) => s + p.pnl, 0);
  const isAuthenticated = useBrokerStore((s) => s.isAuthenticated);
  const connected = BROKERS.filter((b) => isAuthenticated(b.id));

  return (
    <View className="mx-4 mt-4 rounded-2xl bg-zinc-900 border border-zinc-800 p-4 gap-4">
      <View className="items-center">
        <Text className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Total MTM</Text>
        <Text className={`text-4xl font-bold tabular-nums ${totalMtm >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          ₹{Math.abs(totalMtm).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text className={`text-xs mt-0.5 ${totalMtm >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {totalMtm >= 0 ? '▲ Profit' : '▼ Loss'}
        </Text>
      </View>

      {connected.map((b) => {
        const cfg = ppConfigs[b.id];
        if (!cfg) return null;
        return (
          <View key={b.id} className="flex-row items-center justify-between border-t border-zinc-800 pt-3">
            <View className="flex-row items-center gap-2">
              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
              <Text className="text-zinc-300 text-sm font-medium">{b.name}</Text>
              <View className={`px-2 py-0.5 rounded-full ${cfg.enabled ? 'bg-emerald-500/20' : 'bg-zinc-800'}`}>
                <Text className={`text-xs font-semibold ${cfg.enabled ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {cfg.enabled ? 'PP ON' : 'PP OFF'}
                </Text>
              </View>
            </View>
            {cfg.enabled && (
              <View className="flex-row gap-3">
                <Text className="text-zinc-500 text-xs">TGT <Text className="text-white">₹{cfg.mtmTarget.toLocaleString('en-IN')}</Text></Text>
                <Text className="text-zinc-500 text-xs">SL <Text className="text-rose-400">₹{cfg.mtmSl.toLocaleString('en-IN')}</Text></Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
