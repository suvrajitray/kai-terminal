import { apiClient } from './api';

export interface RiskConfig {
  enabled: boolean; watchedProducts: 'All' | 'Intraday' | 'Delivery';
  mtmTarget: number; mtmSl: number;
  trailingEnabled: boolean; trailingActivateAt: number; lockProfitAt: number;
  increaseBy: number; trailBy: number;
  autoShiftEnabled: boolean; autoShiftThresholdPct: number;
  autoShiftMaxCount: number; autoShiftStrikeGap: number;
}

export async function fetchRiskConfig(broker: string): Promise<RiskConfig> {
  const res = await apiClient.get<RiskConfig>(`/api/risk-config`, { params: { broker } });
  return res.data;
}

export async function saveRiskConfig(broker: string, config: Partial<RiskConfig>): Promise<void> {
  await apiClient.put(`/api/risk-config`, config, { params: { broker } });
}
