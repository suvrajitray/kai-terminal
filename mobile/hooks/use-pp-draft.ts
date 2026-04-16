import { useState, useCallback, useEffect } from 'react';
import type { RiskConfig } from '../services/risk-config';

export interface Draft {
  enabled: boolean; watchedProducts: 'All' | 'Intraday' | 'Delivery';
  mtmTarget: string; mtmSl: string;
  trailingEnabled: boolean; trailingActivateAt: string; lockProfitAt: string;
  increaseBy: string; trailBy: string;
  autoShiftEnabled: boolean; autoShiftThresholdPct: string;
  autoShiftMaxCount: string; autoShiftStrikeGap: string;
}

function configToDraft(c: RiskConfig): Draft {
  return {
    enabled: c.enabled, watchedProducts: c.watchedProducts,
    mtmTarget: String(c.mtmTarget), mtmSl: String(c.mtmSl),
    trailingEnabled: c.trailingEnabled,
    trailingActivateAt: String(c.trailingActivateAt),
    lockProfitAt: String(c.lockProfitAt),
    increaseBy: String(c.increaseBy), trailBy: String(c.trailBy),
    autoShiftEnabled: c.autoShiftEnabled,
    autoShiftThresholdPct: String(c.autoShiftThresholdPct),
    autoShiftMaxCount: String(c.autoShiftMaxCount),
    autoShiftStrikeGap: String(c.autoShiftStrikeGap),
  };
}

export function usePpDraft(config: RiskConfig, mtm: number) {
  const [draft, setDraft] = useState<Draft>(() => configToDraft(config));

  useEffect(() => { setDraft(configToDraft(config)); }, [config]);

  const setField = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value })), []);

  const toggleEnabled = useCallback(() =>
    setDraft((d) => {
      const isEnabling = !d.enabled;
      return { ...d, enabled: isEnabling,
        ...(!isEnabling && { autoShiftEnabled: false, trailingEnabled: false }) };
    }), []);

  const targetVal       = Number(draft.mtmTarget);
  const slVal           = Number(draft.mtmSl);
  const activateAtVal   = Number(draft.trailingActivateAt);
  const lockProfitAtVal = Number(draft.lockProfitAt);

  const hasInvalidNumbers = [targetVal, slVal, activateAtVal, lockProfitAtVal].some(isNaN);

  const warnings = {
    targetWarning:     !isNaN(targetVal)       && targetVal <= mtm,
    slWarning:         !isNaN(slVal)           && slVal >= mtm,
    activateAtWarning: draft.trailingEnabled   && !isNaN(activateAtVal)   && activateAtVal >= targetVal,
    lockProfitWarning: draft.trailingEnabled   && !isNaN(lockProfitAtVal) && lockProfitAtVal >= targetVal,
  };

  const canSave = !hasInvalidNumbers && !Object.values(warnings).some(Boolean);

  const toSavePayload = (): Partial<RiskConfig> => ({
    enabled: draft.enabled, watchedProducts: draft.watchedProducts,
    mtmTarget: targetVal, mtmSl: slVal,
    trailingEnabled: draft.trailingEnabled,
    trailingActivateAt: activateAtVal, lockProfitAt: lockProfitAtVal,
    increaseBy: Number(draft.increaseBy), trailBy: Number(draft.trailBy),
    autoShiftEnabled: draft.autoShiftEnabled,
    autoShiftThresholdPct: Number(draft.autoShiftThresholdPct),
    autoShiftMaxCount: Number(draft.autoShiftMaxCount),
    autoShiftStrikeGap: Number(draft.autoShiftStrikeGap),
  });

  return { draft, setField, toggleEnabled, canSave, warnings, toSavePayload };
}
