import { API_BASE_URL } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth-store";

function authHeaders(): HeadersInit {
  const token = useAuthStore.getState().token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface BrokerCredentialResponse {
  brokerName: string;
  apiKey: string;
  apiSecret: string;
}

export async function fetchBrokerCredentials(): Promise<BrokerCredentialResponse[]> {
  const res = await fetch(`${API_BASE_URL}/api/broker-credentials`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch broker credentials");
  return res.json();
}

export async function saveBrokerCredential(
  brokerName: string,
  apiKey: string,
  apiSecret: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/broker-credentials`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ brokerName, apiKey, apiSecret }),
  });
  if (!res.ok) throw new Error("Failed to save broker credentials");
}

export async function deleteBrokerCredential(brokerName: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/broker-credentials/${brokerName}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete broker credentials");
}
