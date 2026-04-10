import { useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useBrokerStore } from "@/stores/broker-store";
import type { ProfitProtectionConfig } from "@/stores/profit-protection-store";

// API shape matches the C# UserRiskConfig (camelCase via System.Text.Json)
interface RiskConfigDto {
  enabled: boolean;
  mtmTarget: number;
  mtmSl: number;
  trailingEnabled: boolean;
  trailingActivateAt: number;
  lockProfitAt: number;
  increaseBy: number;
  trailBy: number;
  autoShiftEnabled: boolean;
  autoShiftThresholdPct: number;
  autoShiftMaxCount: number;
  autoShiftStrikeGap: number;
  watchedProducts: string;
}

function toDto(config: ProfitProtectionConfig): RiskConfigDto {
  return {
    enabled:               config.enabled,
    mtmTarget:             config.mtmTarget,
    mtmSl:                 config.mtmSl,
    trailingEnabled:       config.trailingEnabled,
    trailingActivateAt:    config.trailingActivateAt,
    lockProfitAt:          config.lockProfitAt,
    increaseBy:            config.increaseBy,
    trailBy:               config.trailBy,
    autoShiftEnabled:      config.autoShiftEnabled,
    autoShiftThresholdPct: config.autoShiftThresholdPct,
    autoShiftMaxCount:     config.autoShiftMaxCount,
    autoShiftStrikeGap:    config.autoShiftStrikeGap,
    watchedProducts:       config.watchedProducts,
  };
}

export function useRiskConfig(brokerType: string = "upstox") {
  const isAuthenticated = useBrokerStore((s) => s.isAuthenticated(brokerType));

  useEffect(() => {
    if (!isAuthenticated) return;
    const store = useProfitProtectionStore.getState();
    apiClient.get<RiskConfigDto>(`/api/risk-config?broker=${brokerType}`).then((res) => {
      const { watchedProducts, ...rest } = res.data;
      store.setConfig(brokerType, {
        ...rest,
        watchedProducts: (watchedProducts as "All" | "Intraday" | "Delivery") ?? "All",
      });
      store.markLoaded(brokerType);
    }).catch(() => {
      store.markLoaded(brokerType);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brokerType, isAuthenticated]);

  async function save(config: ProfitProtectionConfig) {
    await apiClient.put(`/api/risk-config?broker=${brokerType}`, toDto(config));
    useProfitProtectionStore.getState().setConfig(brokerType, config);
  }

  function setEnabled(enabled: boolean) {
    const store = useProfitProtectionStore.getState();
    // When disabling PP, also disable trailing and auto-shift
    const patch = enabled
      ? { enabled }
      : { enabled, trailingEnabled: false, autoShiftEnabled: false };
    store.setConfig(brokerType, patch);
    // Persist in background; revert on failure
    const updated = { ...store.getConfig(brokerType), ...patch };
    apiClient.put(`/api/risk-config?broker=${brokerType}`, toDto(updated)).catch(() => {
      store.setEnabled(brokerType, !enabled);
    });
  }

  return { save, setEnabled };
}
