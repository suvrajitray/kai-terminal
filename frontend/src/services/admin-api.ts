import { apiClient } from "@/lib/api-client";

export async function getAnalyticsToken(): Promise<string> {
  const res = await apiClient.get<{ token: string }>("/api/admin/analytics-token");
  return res.data.token;
}

export async function saveAnalyticsToken(token: string): Promise<void> {
  await apiClient.put("/api/admin/analytics-token", { token });
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: string;
  isOnline: boolean;
}

export async function getUsers(): Promise<AdminUser[]> {
  const res = await apiClient.get<AdminUser[]>("/api/admin/users");
  return res.data;
}

export async function setUserActive(id: number, isActive: boolean): Promise<void> {
  await apiClient.patch(`/api/admin/users/${id}/active`, { isActive });
}

export interface RiskLogEntry {
  id: number;
  user: string;
  type: string;
  broker: string;
  mtm: number;
  sl: number;
  target: number;
  tslFloor: number;
  instrumentToken: string;
  shiftCount: number;
  timestamp: string;
}

export async function getAdminRiskLogs(date?: string, days?: number): Promise<RiskLogEntry[]> {
  const params: Record<string, string | number> = {};
  if (date) params.date = date;
  if (days) params.days = days;
  const res = await apiClient.get<RiskLogEntry[]>("/api/admin/risk-logs", { params });
  return res.data;
}

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  onlineUsers: number;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const res = await apiClient.get<AdminDashboardStats>("/api/admin/dashboard-stats");
  return res.data;
}

export interface UserRiskConfig {
  enabled: boolean;
  watchedProducts: string;
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
}

export async function getUserBrokers(email: string): Promise<string[]> {
  const res = await apiClient.get<string[]>(
    `/api/admin/user-brokers?email=${encodeURIComponent(email)}`
  );
  return res.data;
}

export async function getUserRiskConfig(email: string, broker: string): Promise<UserRiskConfig | null> {
  const res = await apiClient.get<UserRiskConfig | null>(
    `/api/admin/risk-config?email=${encodeURIComponent(email)}&broker=${broker}`
  );
  return res.data;
}

export interface AdminPosition {
  exchange: string;
  instrumentToken: string;
  tradingSymbol: string;
  product: string;
  quantity: number;
  buyQuantity: number;
  sellQuantity: number;
  averagePrice: number;
  ltp: number;
  pnl: number;
  unrealised: number;
  realised: number;
  buyPrice: number;
  sellPrice: number;
  buyValue: number;
  sellValue: number;
  broker: string;
  isOpen: boolean;
}

export async function getUserPositions(email: string, broker: string): Promise<AdminPosition[]> {
  const res = await apiClient.get<AdminPosition[]>(
    `/api/admin/positions?email=${encodeURIComponent(email)}&broker=${broker}`
  );
  return res.data;
}
