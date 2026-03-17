import { useEffect, useRef, useState } from "react";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import type { Position } from "@/types";

/**
 * Monitors portfolio MTM against the configured profit target and stop loss.
 *
 * Trailing SL logic:
 * - Floor starts at `mtmSl` and only ever moves up.
 * - Every time MTM gains `increaseBy` from the last step, the floor rises by `trailBy`.
 * - Baseline is seeded from the MTM at the moment PP is first enabled (not from 0),
 *   so no retroactive catch-up happens when PP is toggled on mid-session.
 *
 * Returns `currentSl` — the live trailing floor value for display.
 */
export function useProfitProtection(
  positions: Position[],
  onExitAll: () => void,
) {
  const pp = useProfitProtectionStore();

  // trailSlRef  — current SL floor; starts at mtmSl, only rises
  // lastStepRef — MTM baseline for step calculation; null = not yet initialized
  // firedRef    — one-shot lock: once exit fires, nothing else runs until PP is re-armed
  const trailSlRef  = useRef<number>(pp.mtmSl);
  const lastStepRef = useRef<number | null>(null);
  const firedRef    = useRef(false);
  const [currentSl, setCurrentSl] = useState<number>(pp.mtmSl);

  // Reset when PP is toggled off so it re-initialises cleanly on the next enable.
  useEffect(() => {
    if (!pp.enabled) {
      lastStepRef.current = null;
      firedRef.current    = false;
      trailSlRef.current  = pp.mtmSl;
      setCurrentSl(pp.mtmSl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pp.enabled]);

  // Main monitoring — runs on every positions update.
  // pp values are intentionally NOT in the dep array: we only want to react to
  // new position data, but we always read the latest pp values from the store.
  useEffect(() => {
    if (!pp.enabled || firedRef.current || positions.length === 0) return;

    const mtm = positions.reduce((s, p) => s + p.pnl, 0);

    // Lazy init: seed baseline from current MTM on the first run after enabling.
    if (lastStepRef.current === null) {
      lastStepRef.current = mtm;
      trailSlRef.current  = pp.mtmSl;
      setCurrentSl(pp.mtmSl);
    }

    // If the user tightened mtmSl in settings, raise the floor to match.
    // Never lower it — that would drop a trailing stop already raised.
    if (pp.mtmSl > trailSlRef.current) {
      trailSlRef.current = pp.mtmSl;
      setCurrentSl(pp.mtmSl);
    }

    // ── Target hit ──────────────────────────────────────────────────────────
    if (mtm >= pp.mtmTarget) {
      firedRef.current = true;
      onExitAll();
      return;
    }

    // ── Advance trailing floor ───────────────────────────────────────────────
    if (pp.trailingEnabled && pp.increaseBy > 0) {
      const steps = Math.floor((mtm - lastStepRef.current) / pp.increaseBy);
      if (steps > 0) {
        lastStepRef.current += steps * pp.increaseBy;
        trailSlRef.current  += steps * pp.trailBy;
        setCurrentSl(trailSlRef.current);
      }
    }

    // ── SL hit ───────────────────────────────────────────────────────────────
    if (mtm <= trailSlRef.current) {
      firedRef.current = true;
      onExitAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  return { currentSl };
}
