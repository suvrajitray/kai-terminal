import { useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
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

export function useRiskConfig() {
  const store = useProfitProtectionStore();

  useEffect(() => {
    apiClient.get<RiskConfigDto>("/api/risk-config").then((res) => {
      store.setConfig(res.data);
      store.markLoaded();
    }).catch(() => {
      store.markLoaded(); // show defaults on error
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(config: ProfitProtectionConfig) {
    await apiClient.put("/api/risk-config", toDto(config));
    store.setConfig(config);
  }

  function setEnabled(enabled: boolean) {
    // Optimistic update — flip immediately so the toggle feels instant
    store.setEnabled(enabled);
    // Persist in background; revert on failure
    const updated = { ...useProfitProtectionStore.getState(), enabled };
    apiClient.put("/api/risk-config", toDto(updated)).catch(() => {
      store.setEnabled(!enabled);
    });
  }

  return { save, setEnabled };
}
