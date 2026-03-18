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
}

function toDto(config: ProfitProtectionConfig): RiskConfigDto {
  return {
    enabled:            config.enabled,
    mtmTarget:          config.mtmTarget,
    mtmSl:              config.mtmSl,
    trailingEnabled:    config.trailingEnabled,
    trailingActivateAt: config.trailingActivateAt,
    lockProfitAt:       config.lockProfitAt,
    increaseBy:         config.increaseBy,
    trailBy:            config.trailBy,
  };
}

export function useRiskConfig(brokerType: string = "upstox") {
  const isAuthenticated = useBrokerStore((s) => s.isAuthenticated(brokerType));

  useEffect(() => {
    if (!isAuthenticated) return;
    const store = useProfitProtectionStore.getState();
    apiClient.get<RiskConfigDto>(`/api/risk-config?broker=${brokerType}`).then((res) => {
      store.setConfig(brokerType, res.data);
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
    // Optimistic update — flip immediately so the toggle feels instant
    useProfitProtectionStore.getState().setEnabled(brokerType, enabled);
    // Persist in background; revert on failure
    const updated = { ...useProfitProtectionStore.getState().getConfig(brokerType), enabled };
    apiClient.put(`/api/risk-config?broker=${brokerType}`, toDto(updated)).catch(() => {
      useProfitProtectionStore.getState().setEnabled(brokerType, !enabled);
    });
  }

  return { save, setEnabled };
}
