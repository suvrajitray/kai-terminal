// frontend/src/components/terminal/profit-protection-panel/use-pp-draft.ts
import { useState, useCallback, useMemo } from "react";
import { useProfitProtectionStore, defaults as ppStoreDefaults } from "@/stores/profit-protection-store";
import { usePositionsStore } from "@/stores/positions-store";

export interface Draft {
  enabled: boolean;
  watchedProducts: "All" | "Intraday" | "Delivery";
  mtmTarget: string;
  mtmSl: string;
  trailingEnabled: boolean;
  trailingActivateAt: string;
  lockProfitAt: string;
  increaseBy: string;
  trailBy: string;
  autoShiftEnabled: boolean;
  autoShiftThresholdPct: string;
  autoShiftMaxCount: string;
  autoShiftStrikeGap: string;
}

export const PP_DEFAULTS: Draft = {
  enabled:               ppStoreDefaults.enabled,
  watchedProducts:       ppStoreDefaults.watchedProducts,
  mtmTarget:             String(ppStoreDefaults.mtmTarget),
  mtmSl:                 String(ppStoreDefaults.mtmSl),
  trailingEnabled:       ppStoreDefaults.trailingEnabled,
  trailingActivateAt:    String(ppStoreDefaults.trailingActivateAt),
  lockProfitAt:          String(ppStoreDefaults.lockProfitAt),
  increaseBy:            String(ppStoreDefaults.increaseBy),
  trailBy:               String(ppStoreDefaults.trailBy),
  autoShiftEnabled:      ppStoreDefaults.autoShiftEnabled,
  autoShiftThresholdPct: String(ppStoreDefaults.autoShiftThresholdPct),
  autoShiftMaxCount:     String(ppStoreDefaults.autoShiftMaxCount),
  autoShiftStrikeGap:    String(ppStoreDefaults.autoShiftStrikeGap),
};

function makeDraft(broker: string): Draft {
  const p = useProfitProtectionStore.getState().getConfig(broker);
  return {
    enabled:               p.enabled,
    watchedProducts:       p.watchedProducts,
    mtmTarget:             String(p.mtmTarget),
    mtmSl:                 String(p.mtmSl),
    trailingEnabled:       p.trailingEnabled,
    trailingActivateAt:    String(p.trailingActivateAt),
    lockProfitAt:          String(p.lockProfitAt),
    increaseBy:            String(p.increaseBy),
    trailBy:               String(p.trailBy),
    autoShiftEnabled:      p.autoShiftEnabled,
    autoShiftThresholdPct: String(p.autoShiftThresholdPct),
    autoShiftMaxCount:     String(p.autoShiftMaxCount),
    autoShiftStrikeGap:    String(p.autoShiftStrikeGap),
  };
}

export function usePpDraft(broker: string) {
  const positions = usePositionsStore((s) => s.positions);
  const [draft, setDraft] = useState<Draft>(() => makeDraft(broker));

  const resetToBroker = useCallback((b: string) => {
    setDraft(makeDraft(b));
  }, []);

  const setField = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const toggleEnabled = useCallback(() => {
    setDraft((d) => {
      const isEnabling = !d.enabled;
      return {
        ...d,
        enabled: isEnabling,
        // When disabling, also turn off dependent toggles so they don't
        // silently re-activate if the user re-enables PP later.
        ...(!isEnabling && { autoShiftEnabled: false, trailingEnabled: false }),
      };
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setDraft(PP_DEFAULTS);
  }, []);

  // Derived numeric values
  const targetVal       = Number(draft.mtmTarget);
  const slVal           = Number(draft.mtmSl);
  const activateAtVal   = Number(draft.trailingActivateAt);
  const lockProfitAtVal = Number(draft.lockProfitAt);
  const increaseByVal   = Number(draft.increaseBy);
  const trailByVal      = Number(draft.trailBy);

  const hasInvalidNumbers = isNaN(targetVal) || isNaN(slVal) || isNaN(activateAtVal) || isNaN(lockProfitAtVal);

  const currentMtm = useMemo(() =>
    positions
      .filter((p) => (p.broker ?? "upstox") === broker)
      .filter((p) => draft.watchedProducts === "All" || p.product === draft.watchedProducts)
      .reduce((sum, p) => sum + p.pnl, 0),
    [positions, broker, draft.watchedProducts]);

  const warnings = {
    targetWarning:     !isNaN(targetVal)     && targetVal <= currentMtm,
    slWarning:         !isNaN(slVal)         && slVal >= currentMtm,
    activateAtWarning: draft.trailingEnabled && !isNaN(activateAtVal) && !isNaN(targetVal) && activateAtVal >= targetVal,
    lockProfitWarning: draft.trailingEnabled && !isNaN(lockProfitAtVal) && !isNaN(targetVal) && lockProfitAtVal >= targetVal,
  };

  const canSave = !hasInvalidNumbers && !Object.values(warnings).some(Boolean);

  const toSavePayload = () => ({
    enabled:               draft.enabled,
    watchedProducts:       draft.watchedProducts,
    mtmTarget:             targetVal,
    mtmSl:                 slVal,
    trailingEnabled:       draft.trailingEnabled,
    trailingActivateAt:    activateAtVal,
    lockProfitAt:          lockProfitAtVal,
    increaseBy:            increaseByVal,
    trailBy:               trailByVal,
    autoShiftEnabled:      draft.autoShiftEnabled,
    autoShiftThresholdPct: Number(draft.autoShiftThresholdPct),
    autoShiftMaxCount:     Number(draft.autoShiftMaxCount),
    autoShiftStrikeGap:    Number(draft.autoShiftStrikeGap),
  });

  return {
    draft, setField, toggleEnabled, resetToBroker, resetToDefaults,
    currentMtm, warnings, canSave, toSavePayload,
    increaseByVal, trailByVal, slVal, activateAtVal, lockProfitAtVal,
  };
}
