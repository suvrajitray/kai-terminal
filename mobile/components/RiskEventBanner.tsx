import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface RiskEvent { type: string; mtm: number; timestamp: string; broker: string; }

const LABELS: Record<string, string> = {
  TslRaised: 'TSL RAISED', TslActivated: 'TSL ACTIVATED', TslHit: 'TSL HIT',
  HardSlHit: 'SL HIT', TargetHit: 'TARGET HIT',
  AutoShiftTriggered: 'AUTO SHIFT', AutoShiftExhausted: 'AUTO SHIFT EXHAUSTED',
};

export function RiskEventBanner({ event }: { event: RiskEvent | null }) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (!event || dismissed === event.timestamp) return null;
  if ((Date.now() - new Date(event.timestamp).getTime()) / 60000 > 5) return null;

  return (
    <View className="mx-4 mt-3 bg-amber-500/15 border border-amber-500/40 rounded-xl px-4 py-3 flex-row items-center justify-between">
      <View>
        <Text className="text-amber-400 text-xs font-bold">{LABELS[event.type] ?? event.type}</Text>
        <Text className="text-amber-300/70 text-xs">
          {event.broker} · MTM ₹{event.mtm.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </Text>
      </View>
      <TouchableOpacity onPress={() => setDismissed(event.timestamp)}>
        <Text className="text-amber-400 text-lg">×</Text>
      </TouchableOpacity>
    </View>
  );
}
