import { apiClient } from "@/lib/api-client";

export async function getAnalyticsToken(): Promise<string> {
  const res = await apiClient.get<{ token: string }>("/api/admin/analytics-token");
  return res.data.token;
}

export async function saveAnalyticsToken(token: string): Promise<void> {
  await apiClient.put("/api/admin/analytics-token", { token });
}
