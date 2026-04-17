import { apiClient } from "@/lib/api-client";

export interface BrokerCredentialResponse {
  brokerName: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
}

export async function fetchBrokerCredentials(): Promise<BrokerCredentialResponse[]> {
  const res = await apiClient.get<BrokerCredentialResponse[]>("/api/broker-credentials");
  return res.data;
}

export async function saveBrokerCredential(
  brokerName: string,
  apiKey: string,
  apiSecret: string,
): Promise<void> {
  await apiClient.post("/api/broker-credentials", { brokerName, apiKey, apiSecret });
}

export async function deleteBrokerCredential(brokerName: string): Promise<void> {
  await apiClient.delete(`/api/broker-credentials/${brokerName}`);
}

export async function updateBrokerAccessToken(brokerName: string, accessToken: string): Promise<void> {
  await apiClient.put(`/api/broker-credentials/${brokerName}/access-token`, { accessToken });
}

export async function exchangeAccessToken(
  apiKey: string,
  apiSecret: string,
  redirectUri: string,
  code: string,
): Promise<string> {
  const res = await apiClient.post<{ accessToken: string }>("/api/upstox/access-token", {
    apiKey,
    apiSecret,
    redirectUri,
    code,
  });
  return res.data.accessToken;
}

export async function exchangeZerodhaToken(
  apiKey: string,
  apiSecret: string,
  requestToken: string,
): Promise<string> {
  const res = await apiClient.post<{ accessToken: string }>("/api/zerodha/access-token", {
    apiKey,
    apiSecret,
    requestToken,
  });
  return res.data.accessToken;
}
