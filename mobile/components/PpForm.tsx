import { View, Text, TextInput, Switch } from 'react-native';
import type { Draft } from '../hooks/use-pp-draft';

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  warn?: boolean;
}

function Field({ label, value, onChange, warn }: FieldProps) {
  return (
    <View className="mb-4">
      <Text className="text-zinc-400 text-xs mb-1.5">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor="#52525b"
        className={`bg-zinc-900/80 rounded-xl px-4 py-3 text-white text-base border ${
          warn ? 'border-amber-500/60' : 'border-zinc-700/60'
        }`}
      />
      {warn && (
        <Text className="text-amber-400 text-[10px] mt-1">
          ⚠ Check this value against current MTM
        </Text>
      )}
    </View>
  );
}

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function Toggle({ label, value, onChange, disabled }: ToggleProps) {
  return (
    <View className="flex-row items-center justify-between mb-4 py-1">
      <Text className={`text-sm ${disabled ? 'text-zinc-600' : 'text-zinc-300'}`}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: '#3f3f46', true: '#7B2FF7' }}
        thumbColor="white"
      />
    </View>
  );
}

interface PpFormProps {
  draft: Draft;
  onField: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  warnings: {
    targetWarning: boolean;
    slWarning: boolean;
    activateAtWarning: boolean;
    lockProfitWarning: boolean;
  };
  disabled?: boolean;
}

export function PpForm({ draft, onField, warnings, disabled }: PpFormProps) {
  return (
    <View>
      <Field
        label="MTM Target (₹)"
        value={draft.mtmTarget}
        onChange={(v) => onField('mtmTarget', v)}
        warn={warnings.targetWarning}
      />
      <Field
        label="MTM Stop Loss (₹)"
        value={draft.mtmSl}
        onChange={(v) => onField('mtmSl', v)}
        warn={warnings.slWarning}
      />

      <Toggle
        label="Trailing Stop Loss"
        value={draft.trailingEnabled}
        onChange={(v) => onField('trailingEnabled', v)}
        disabled={disabled}
      />

      {draft.trailingEnabled && (
        <View className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-4 mb-4">
          <Field
            label="Activate at (₹)"
            value={draft.trailingActivateAt}
            onChange={(v) => onField('trailingActivateAt', v)}
            warn={warnings.activateAtWarning}
          />
          <Field
            label="Lock profit at (₹)"
            value={draft.lockProfitAt}
            onChange={(v) => onField('lockProfitAt', v)}
            warn={warnings.lockProfitWarning}
          />
          <Field
            label="Increase by (₹)"
            value={draft.increaseBy}
            onChange={(v) => onField('increaseBy', v)}
          />
          <Field
            label="Trail by (₹)"
            value={draft.trailBy}
            onChange={(v) => onField('trailBy', v)}
          />
        </View>
      )}

      <Toggle
        label="Auto Shift"
        value={draft.autoShiftEnabled}
        onChange={(v) => onField('autoShiftEnabled', v)}
        disabled={disabled}
      />

      {draft.autoShiftEnabled && (
        <View className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-4 mb-4">
          <Field
            label="Threshold (%)"
            value={draft.autoShiftThresholdPct}
            onChange={(v) => onField('autoShiftThresholdPct', v)}
          />
          <Field
            label="Max shifts"
            value={draft.autoShiftMaxCount}
            onChange={(v) => onField('autoShiftMaxCount', v)}
          />
          <Field
            label="Strike gap"
            value={draft.autoShiftStrikeGap}
            onChange={(v) => onField('autoShiftStrikeGap', v)}
          />
        </View>
      )}
    </View>
  );
}
