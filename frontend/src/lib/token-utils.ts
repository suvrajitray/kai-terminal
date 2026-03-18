import { useBrokerStore } from "@/stores/broker-store";

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

// Brokers whose tokens are JWTs with a verifiable expiry.
const JWT_BROKERS = new Set(["upstox"]);

/**
 * Checks whether a broker's access token is missing or expired.
 * - Empty/missing token → always true (no valid session).
 * - JWT brokers (Upstox): decodes expiry from the token.
 * - Session-token brokers (Zerodha, Dhan, …): expiry cannot be verified
 *   client-side — a present token is treated as valid.
 */
export function isBrokerTokenExpired(brokerId: string, token: string | undefined | null): boolean {
  if (!token) return true;
  if (!JWT_BROKERS.has(brokerId)) return false;
  return isTokenExpired(token);
}

export function getUpstoxToken(): string | null {
  return useBrokerStore.getState().getCredentials("upstox")?.accessToken ?? null;
}
