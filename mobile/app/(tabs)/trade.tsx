import { ScrollView, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { fetchMasterContracts, IndexContracts } from '../../services/contracts';
import { placeOrderByPrice } from '../../services/trading';
import { useBrokerStore } from '../../stores/broker-store';
import { BROKERS, UNDERLYING_KEYS } from '../../constants';

const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX', 'BANKEX'] as const;
const LOT_SIZES: Record<string, number> = {
  NIFTY: 75, BANKNIFTY: 30, FINNIFTY: 40, SENSEX: 10, BANKEX: 15,
};

type Side = 'Buy' | 'Sell';
type OptionType = 'CE' | 'PE';

// A reusable pill row for horizontal option selection
function PillRow<T extends string>({ options, value, onChange, colorOf }: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  colorOf?: (v: T) => string;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const color = colorOf?.(o);
        const active = value === o;
        return (
          <TouchableOpacity
            key={o}
            onPress={() => onChange(o)}
            className={`px-3 py-1.5 rounded-lg border ${active ? 'border-violet-500 bg-violet-500/20' : 'border-zinc-700 bg-zinc-900'}`}
            style={active && color ? { borderColor: color + '99', backgroundColor: color + '22' } : undefined}
          >
            <Text
              style={active && color ? { color } : undefined}
              className={active && !color ? 'text-violet-300 text-xs font-semibold' : 'text-zinc-400 text-xs'}
            >
              {o}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TradeScreen() {
  const isAuthenticated = useBrokerStore((s) => s.isAuthenticated);
  const connectedBrokers = useMemo(
    () => BROKERS.filter((b) => isAuthenticated(b.id)),
    [isAuthenticated]
  );

  const [contracts, setContracts] = useState<IndexContracts[]>([]);
  const [index, setIndex] = useState<typeof INDICES[number]>('NIFTY');
  const [expiry, setExpiry] = useState('');
  const [optType, setOptType] = useState<OptionType>('CE');
  const [side, setSide] = useState<Side>('Sell');
  const [premium, setPremium] = useState('');
  const [lots, setLots] = useState('1');
  const [product, setProduct] = useState<'Intraday' | 'Delivery'>('Intraday');
  const [broker, setBroker] = useState(connectedBrokers[0]?.id ?? 'upstox');

  useEffect(() => {
    if (connectedBrokers.length > 0 && !connectedBrokers.some((b) => b.id === broker)) {
      setBroker(connectedBrokers[0].id);
    }
  }, [connectedBrokers]);
  const [placing, setPlacing] = useState(false);
  const [status, setStatus] = useState<{ text: string; success: boolean } | null>(null);

  useEffect(() => {
    fetchMasterContracts().then(setContracts).catch(console.error);
  }, []);

  const expiries = useMemo(() => {
    const entry = contracts.find((c) => c.index === index);
    if (!entry) return [];
    return [...new Set(entry.contracts.map((c) => c.expiry))].sort();
  }, [contracts, index]);

  useEffect(() => {
    if (expiries.length) setExpiry(expiries[0]);
  }, [expiries]);

  const handlePlace = async () => {
    const targetPremium = Number(premium);
    const lotCount = Number(lots) || 1;
    const qty = lotCount * (LOT_SIZES[index] ?? 75);

    if (!targetPremium || targetPremium <= 0) {
      setStatus({ text: 'Enter a valid premium', success: false });
      return;
    }
    if (!expiry) {
      setStatus({ text: 'Select an expiry', success: false });
      return;
    }

    setPlacing(true);
    setStatus(null);
    try {
      await placeOrderByPrice(broker, {
        underlyingKey: UNDERLYING_KEYS[index],
        expiry,
        instrumentType: optType,
        targetPremium,
        qty,
        transactionType: side,
        product,
      });
      setStatus({
        text: `✓ ${side} ${lots} lot${lotCount !== 1 ? 's' : ''} ${index} ${optType} placed at ₹${targetPremium}`,
        success: true,
      });
      setPremium('');
    } catch (e: any) {
      const msg = e?.response?.data?.title ?? e?.response?.data ?? e?.message ?? 'Unknown error';
      setStatus({ text: `Error: ${msg}`, success: false });
    } finally {
      setPlacing(false);
    }
  };

  const canPlace = !!premium && Number(premium) > 0 && !!expiry && !placing;

  return (
    <ScrollView className="flex-1 bg-zinc-950" keyboardShouldPersistTaps="handled">
      <View className="px-4 pt-12 pb-8 gap-6">
        <Text className="text-white text-xl font-bold">Quick Trade</Text>

        {/* Index */}
        <View className="gap-2">
          <Text className="text-zinc-500 text-xs uppercase tracking-wider">Index</Text>
          <PillRow
            options={INDICES}
            value={index}
            onChange={(v) => setIndex(v as typeof INDICES[number])}
          />
        </View>

        {/* Expiry */}
        <View className="gap-2">
          <Text className="text-zinc-500 text-xs uppercase tracking-wider">Expiry</Text>
          {expiries.length === 0 ? (
            <Text className="text-zinc-600 text-sm">Loading…</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {expiries.map((e) => (
                  <TouchableOpacity
                    key={e}
                    onPress={() => setExpiry(e)}
                    className={`px-3 py-1.5 rounded-lg border ${expiry === e ? 'border-violet-500 bg-violet-500/20' : 'border-zinc-700 bg-zinc-900'}`}
                  >
                    <Text className={expiry === e ? 'text-violet-300 text-xs font-semibold' : 'text-zinc-400 text-xs'}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Option Type */}
        <View className="gap-2">
          <Text className="text-zinc-500 text-xs uppercase tracking-wider">Option Type</Text>
          <View className="flex-row gap-3">
            {(['CE', 'PE'] as OptionType[]).map((o) => (
              <TouchableOpacity
                key={o}
                onPress={() => setOptType(o)}
                className={`flex-1 py-2.5 rounded-xl border items-center ${
                  optType === o
                    ? (o === 'CE' ? 'border-rose-500/60 bg-rose-500/15' : 'border-emerald-500/60 bg-emerald-500/15')
                    : 'border-zinc-700 bg-zinc-900'
                }`}
              >
                <Text className={optType === o ? (o === 'CE' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold') : 'text-zinc-400'}>
                  {o}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Side */}
        <View className="gap-2">
          <Text className="text-zinc-500 text-xs uppercase tracking-wider">Side</Text>
          <View className="flex-row gap-3">
            {(['Buy', 'Sell'] as Side[]).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSide(s)}
                className={`flex-1 py-2.5 rounded-xl border items-center ${
                  side === s
                    ? (s === 'Buy' ? 'border-emerald-500/60 bg-emerald-500/15' : 'border-rose-500/60 bg-rose-500/15')
                    : 'border-zinc-700 bg-zinc-900'
                }`}
              >
                <Text className={side === s ? (s === 'Buy' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold') : 'text-zinc-400'}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Premium + Lots */}
        <View className="flex-row gap-3">
          <View className="flex-1 gap-2">
            <Text className="text-zinc-500 text-xs uppercase tracking-wider">Target Premium (₹)</Text>
            <TextInput
              value={premium}
              onChangeText={setPremium}
              keyboardType="decimal-pad"
              placeholder="e.g. 120"
              placeholderTextColor="#52525b"
              className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-base"
            />
          </View>
          <View className="w-24 gap-2">
            <Text className="text-zinc-500 text-xs uppercase tracking-wider">Lots</Text>
            <TextInput
              value={lots}
              onChangeText={setLots}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor="#52525b"
              className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-base"
            />
          </View>
        </View>

        {/* Product */}
        <View className="gap-2">
          <Text className="text-zinc-500 text-xs uppercase tracking-wider">Product</Text>
          <PillRow
            options={['Intraday', 'Delivery'] as const}
            value={product}
            onChange={(v) => setProduct(v as 'Intraday' | 'Delivery')}
          />
        </View>

        {/* Broker (only shown when multiple brokers connected) */}
        {connectedBrokers.length > 1 && (
          <View className="gap-2">
            <Text className="text-zinc-500 text-xs uppercase tracking-wider">Broker</Text>
            <PillRow
              options={connectedBrokers.map((b) => b.id) as unknown as readonly string[]}
              value={broker}
              onChange={(v) => setBroker(v as typeof broker)}
              colorOf={(id) => BROKERS.find((b) => b.id === id)?.color ?? '#7B2FF7'}
            />
          </View>
        )}

        {/* Order summary + Place button */}
        <TouchableOpacity
          onPress={handlePlace}
          disabled={!canPlace}
          className={`py-4 rounded-2xl items-center ${
            side === 'Buy' ? 'bg-emerald-500' : 'bg-rose-500'
          } ${!canPlace ? 'opacity-50' : ''}`}
        >
          {placing ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-base">
              {side} {index} {optType} @ ₹{premium || '—'} · {lots} lot{(Number(lots) || 1) !== 1 ? 's' : ''}
            </Text>
          )}
        </TouchableOpacity>

        {/* Status message */}
        {status && (
          <Text className={`text-center text-sm ${status.success ? 'text-emerald-400' : 'text-rose-400'}`}>
            {status.text}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
