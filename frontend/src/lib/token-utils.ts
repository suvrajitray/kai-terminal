import { useEffect, useState } from "react";
import { useBrokerStore } from "@/stores/broker-store";

/** Checks whether the user's auth JWT has expired. */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

/**
 * Broker token validity is determined entirely by the backend — it returns ""
 * for stale/expired tokens. Frontend just checks truthiness.
 */
export function isBrokerTokenExpired(_brokerId: string, token: string | undefined | null): boolean {
  return !token;
}

export function getUpstoxToken(): string | null {
  return useBrokerStore.getState().getCredentials("upstox")?.accessToken ?? null;
}

function secondsUntilEightAmIst(): number {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(Date.now() + istOffsetMs);
  const h = nowIst.getUTCHours();
  const m = nowIst.getUTCMinutes();
  const s = nowIst.getUTCSeconds();
  if (h >= 8) return 0;
  return (8 - h) * 3600 - m * 60 - s;
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function useCountdownToEightAmIst(): { isBeforeEight: boolean; countdown: string } {
  const [seconds, setSeconds] = useState(secondsUntilEightAmIst);

  useEffect(() => {
    const id = setInterval(() => setSeconds(secondsUntilEightAmIst()), 1000);
    return () => clearInterval(id);
  }, []);

  return { isBeforeEight: seconds > 0, countdown: formatCountdown(seconds) };
}
