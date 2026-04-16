import { View, Text, TouchableOpacity } from 'react-native';
import { BROKERS } from '../constants';

interface BrokerPillsProps {
  active: string;
  onChange: (id: string) => void;
  available: string[];
}

export function BrokerPills({ active, onChange, available }: BrokerPillsProps) {
  const brokers = BROKERS.filter((b) => available.includes(b.id));
  if (brokers.length <= 1) return null;
  return (
    <View className="flex-row gap-3">
      {brokers.map((b) => (
        <TouchableOpacity
          key={b.id}
          onPress={() => onChange(b.id)}
          className="flex-1 py-2.5 rounded-xl border items-center"
          style={
            active === b.id
              ? { borderColor: b.color + '99', backgroundColor: b.color + '22' }
              : { borderColor: '#3f3f46', backgroundColor: '#18181b' }
          }
        >
          <Text
            style={{ color: active === b.id ? b.color : '#71717a' }}
            className="text-sm font-semibold"
          >
            {b.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
