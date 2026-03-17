import { useEffect, useRef, useState } from "react";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import type { Position } from "@/types";

/**
 * Monitors portfolio MTM against the configured profit target and stop loss.
 *
 * Evaluation order (matches backend RiskEvaluator):
 *   1. Hard SL (mtmSl)
 *   2. Profit target (mtmTarget)
 *   3. Trailing SL
 *
 * Trailing SL logic:
 * - Gated by `trailingActivateAt`: stays inactive until MTM first reaches that threshold.
 * - On activation, floor immediately jumps to `lockProfitAt` (guaranteed profit floor).
 * - Every time MTM then gains `increaseBy` from the last step, the floor rises by `trailBy`.
 *
 * Returns `currentSl` — the live trailing floor value for display.
 */
export function useProfitProtection(
  positions: Position[],
  onExitAll: () => void,
) {
  const pp = useProfitProtectionStore();

  // trailSlRef     — current SL floor; starts at mtmSl, only rises
  // lastStepRef    — MTM baseline for step calculation; null = trailing not yet active
  // initializedRef — true after first run (distinguishes "not started" from "waiting for activate threshold")
  // firedRef       — one-shot lock: once exit fires, nothing else runs until PP is re-armed
  const trailSlRef     = useRef<number>(pp.mtmSl);
  const lastStepRef    = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const firedRef       = useRef(false);
  const [currentSl, setCurrentSl] = useState<number>(pp.mtmSl);

  // Reset when PP is toggled off so it re-initialises cleanly on the next enable.
  useEffect(() => {
    if (!pp.enabled) {
      lastStepRef.current    = null;
      initializedRef.current = false;
      firedRef.current       = false;
      trailSlRef.current     = pp.mtmSl;
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

    // First run after enabling: set the SL floor; do NOT seed trailing baseline yet.
    if (!initializedRef.current) {
      initializedRef.current = true;
      trailSlRef.current     = pp.mtmSl;
      setCurrentSl(pp.mtmSl);
      // lastStepRef stays null — trailing waits for the activation threshold
    }

    // If the user tightened mtmSl in settings, raise the floor to match.
    // Never lower it — that would drop a trailing stop already raised.
    if (pp.mtmSl > trailSlRef.current) {
      trailSlRef.current = pp.mtmSl;
      setCurrentSl(pp.mtmSl);
    }

    // ── 1. Hard SL hit ───────────────────────────────────────────────────────
    if (mtm <= trailSlRef.current) {
      firedRef.current = true;
      onExitAll();
      return;
    }

    // ── 2. Target hit ────────────────────────────────────────────────────────
    if (mtm >= pp.mtmTarget) {
      firedRef.current = true;
      onExitAll();
      return;
    }

    // ── 3. Trailing SL ───────────────────────────────────────────────────────

    // Activation gate: seed baseline and lock in profit floor on first threshold crossing.
    if (pp.trailingEnabled && lastStepRef.current === null && mtm >= pp.trailingActivateAt) {
      lastStepRef.current = mtm;
      trailSlRef.current  = Math.max(pp.lockProfitAt, trailSlRef.current);
      setCurrentSl(trailSlRef.current);
    }

    // Advance trailing floor
    if (pp.trailingEnabled && lastStepRef.current !== null && pp.increaseBy > 0) {
      const steps = Math.floor((mtm - lastStepRef.current) / pp.increaseBy);
      if (steps > 0) {
        lastStepRef.current += steps * pp.increaseBy;
        trailSlRef.current  += steps * pp.trailBy;
        setCurrentSl(trailSlRef.current);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  return { currentSl };
}
