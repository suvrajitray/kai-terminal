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
}

export async function getUsers(): Promise<AdminUser[]> {
  const res = await apiClient.get<AdminUser[]>("/api/admin/users");
  return res.data;
}

export async function setUserActive(id: number, isActive: boolean): Promise<void> {
  await apiClient.patch(`/api/admin/users/${id}/active`, { isActive });
}
