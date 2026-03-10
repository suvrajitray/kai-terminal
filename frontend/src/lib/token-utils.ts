import { useBrokerStore } from "@/stores/broker-store";

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

export function getUpstoxToken(): string | null {
  return useBrokerStore.getState().getCredentials("upstox")?.accessToken ?? null;
}
