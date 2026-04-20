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

// Single source of truth for the broker token cutoff time (IST).
// Update here to change the cutoff everywhere in the UI.
export const TOKEN_CUTOFF_IST = { hours: 7, minutes: 30 };
export const TOKEN_CUTOFF_LABEL = `${String(TOKEN_CUTOFF_IST.hours).padStart(2, "0")}:${String(TOKEN_CUTOFF_IST.minutes).padStart(2, "0")} AM IST`;

function secondsUntilCutoff(): number {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(Date.now() + istOffsetMs);
  const totalSeconds = nowIst.getUTCHours() * 3600 + nowIst.getUTCMinutes() * 60 + nowIst.getUTCSeconds();
  const cutoffSeconds = TOKEN_CUTOFF_IST.hours * 3600 + TOKEN_CUTOFF_IST.minutes * 60;
  return Math.max(0, cutoffSeconds - totalSeconds);
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function useBrokerCutoffCountdown(): { isBeforeCutoff: boolean; countdown: string } {
  const [seconds, setSeconds] = useState(secondsUntilCutoff);

  useEffect(() => {
    const id = setInterval(() => setSeconds(secondsUntilCutoff()), 1000);
    return () => clearInterval(id);
  }, []);

  return { isBeforeCutoff: seconds > 0, countdown: formatCountdown(seconds) };
}
