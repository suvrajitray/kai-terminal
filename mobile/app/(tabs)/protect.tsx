import { ScrollView, View, Text, Switch, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react-native';
import { useBrokerStore } from '../../stores/broker-store';
import { useRiskConfig } from '../../hooks/use-risk-config';
import { usePpDraft } from '../../hooks/use-pp-draft';
import { useLivePositions } from '../../hooks/use-live-positions';
import { BROKERS } from '../../constants';
import { BrokerPills } from '../../components/BrokerPills';
import { PpForm } from '../../components/PpForm';

export default function ProtectScreen() {
  const authenticated = useBrokerStore((s) => s.authenticated);
  const connectedBrokers = useMemo(
    () => BROKERS.filter((b) => authenticated[b.id] ?? false),
    [authenticated]
  );
  const [activeBroker, setActiveBroker] = useState(connectedBrokers[0]?.id ?? 'upstox');

  useEffect(() => {
    if (connectedBrokers.length > 0 && !connectedBrokers.find((b) => b.id === activeBroker)) {
      setActiveBroker(connectedBrokers[0].id);
    }
  }, [connectedBrokers, activeBroker]);

  const { config, loading, save } = useRiskConfig(activeBroker);
  const { positions } = useLivePositions();

  const mtm = useMemo(
    () =>
      positions
        .filter((p) => (p.broker ?? 'upstox') === activeBroker)
        .reduce((sum, p) => sum + p.pnl, 0),
    [positions, activeBroker]
  );

  const { draft, setField, toggleEnabled, canSave, warnings, toSavePayload } = usePpDraft(config, mtm);

  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await save(toSavePayload());
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e: any) {
      Alert.alert('Save failed', (e as Error)?.message ?? 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-zinc-950" keyboardShouldPersistTaps="handled">
      <View className="px-4 pt-12 pb-8 gap-5">
        <Text className="text-white text-xl font-bold">Profit Protection</Text>

        {/* Broker pill selector */}
        <BrokerPills
          active={activeBroker}
          onChange={setActiveBroker}
          available={connectedBrokers.map((b) => b.id)}
        />

        {/* Current MTM */}
        <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 items-center">
          <Text className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">Current MTM</Text>
          <Text className={`text-2xl font-bold tabular-nums ${mtm >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ₹{mtm.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>

        {/* Enable/Disable toggle card */}
        <View
          className={`rounded-2xl border p-4 ${
            draft.enabled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900'
          }`}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 flex-1 mr-4">
              {draft.enabled ? (
                <ShieldCheck size={16} color="#22c55e" />
              ) : (
                <ShieldOff size={16} color="#71717a" />
              )}
              <View className="flex-1">
                <Text className="text-white font-semibold text-sm">
                  {draft.enabled ? 'Protection Enabled' : 'Protection Disabled'}
                </Text>
                <Text className="text-zinc-500 text-xs mt-0.5">
                  {draft.enabled
                    ? 'Risk engine will enforce targets and stops once saved'
                    : 'Enable to activate automatic risk management'}
                </Text>
              </View>
            </View>
            <Switch
              value={draft.enabled}
              onValueChange={toggleEnabled}
              trackColor={{ false: '#3f3f46', true: '#22c55e' }}
              thumbColor="white"
            />
          </View>
        </View>

        {/* Loading state */}
        {loading ? (
          <View className="items-center py-8">
            <ActivityIndicator color="#7B2FF7" />
            <Text className="text-zinc-500 text-xs mt-2">Loading config…</Text>
          </View>
        ) : (
          <PpForm draft={draft} onField={setField} warnings={warnings} disabled={!draft.enabled} />
        )}

        {/* Save button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={!canSave || saving}
          className={`py-4 rounded-2xl items-center ${
            canSave && !saving ? 'bg-violet-600' : 'bg-zinc-800'
          }`}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className={`font-bold text-base ${canSave ? 'text-white' : 'text-zinc-500'}`}>
              {savedFlash ? '✓ Saved' : 'Save Configuration'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
