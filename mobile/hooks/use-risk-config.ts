import { useState, useEffect, useCallback } from 'react';
import { fetchRiskConfig, saveRiskConfig, RiskConfig } from '../services/risk-config';
import { useAuthStore } from '../stores/auth-store';

const DEFAULT: RiskConfig = {
  enabled: false, watchedProducts: 'All', mtmTarget: 0, mtmSl: 0,
  trailingEnabled: false, trailingActivateAt: 0, lockProfitAt: 0,
  increaseBy: 0, trailBy: 0, autoShiftEnabled: false,
  autoShiftThresholdPct: 0, autoShiftMaxCount: 0, autoShiftStrikeGap: 0,
};

export function useRiskConfig(broker: string) {
  const token = useAuthStore((s) => s.token);
  const [config, setConfig] = useState<RiskConfig>(DEFAULT);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!broker || !token) return;
    setLoading(true);
    try { setConfig(await fetchRiskConfig(broker)); } finally { setLoading(false); }
  }, [broker, token]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (updates: Partial<RiskConfig>) => {
    await saveRiskConfig(broker, updates);
    setConfig((c) => ({ ...c, ...updates }));
  }, [broker]);

  return { config, loading, save };
}
