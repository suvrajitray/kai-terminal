import { apiClient } from './api';

export interface BrokerCredentialResponse {
  brokerName: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string; // "NA" if not authenticated
}

export async function fetchBrokerCredentials(): Promise<BrokerCredentialResponse[]> {
  const res = await apiClient.get<BrokerCredentialResponse[]>('/api/broker-credentials');
  return res.data;
}

export async function exchangeUpstoxToken(
  apiKey: string,
  apiSecret: string,
  redirectUri: string,
  code: string,
): Promise<string> {
  const res = await apiClient.post<{ accessToken: string }>('/api/upstox/access-token', {
    apiKey, apiSecret, redirectUri, code,
  });
  return res.data.accessToken;
}

export async function exchangeZerodhaToken(
  apiKey: string,
  apiSecret: string,
  requestToken: string,
): Promise<string> {
  const res = await apiClient.post<{ accessToken: string }>('/api/zerodha/access-token', {
    apiKey, apiSecret, requestToken,
  });
  return res.data.accessToken;
}

export async function updateBrokerAccessToken(brokerName: string, accessToken: string): Promise<void> {
  await apiClient.put(`/api/broker-credentials/${brokerName}/access-token`, { accessToken });
}
