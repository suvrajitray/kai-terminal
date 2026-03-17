import { useEffect, useRef, useState } from "react";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import type { Position } from "@/types";

/**
 * Tracks portfolio MTM against the configured profit protection settings for display purposes.
 * Exit orders are handled by the backend Worker — this hook computes currentSl for UI display only.
 *
 * Trailing SL logic mirrors backend RiskEvaluator:
 * - Gated by `trailingActivateAt`: stays inactive until MTM first reaches that threshold.
 * - On activation, floor immediately jumps to `lockProfitAt`.
 * - Every time MTM then gains `increaseBy` from the last step, the floor rises by `trailBy`.
 *
 * Returns `currentSl` — the live trailing floor value for display.
 */
export function useProfitProtection(positions: Position[]) {
  const pp = useProfitProtectionStore();

  const trailSlRef     = useRef<number>(pp.mtmSl);
  const lastStepRef    = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const [currentSl, setCurrentSl] = useState<number>(pp.mtmSl);

  // Reset when PP is toggled off so it re-initialises cleanly on the next enable.
  useEffect(() => {
    if (!pp.enabled) {
      lastStepRef.current    = null;
      initializedRef.current = false;
      trailSlRef.current     = pp.mtmSl;
      setCurrentSl(pp.mtmSl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pp.enabled]);

  // Compute trailing SL for display — runs on every positions update.
  useEffect(() => {
    if (!pp.enabled || positions.length === 0) return;

    const mtm = positions.reduce((s, p) => s + p.pnl, 0);

    if (!initializedRef.current) {
      initializedRef.current = true;
      trailSlRef.current     = pp.mtmSl;
      setCurrentSl(pp.mtmSl);
    }

    if (pp.mtmSl > trailSlRef.current) {
      trailSlRef.current = pp.mtmSl;
      setCurrentSl(pp.mtmSl);
    }

    if (pp.trailingEnabled && lastStepRef.current === null && mtm >= pp.trailingActivateAt) {
      lastStepRef.current = mtm;
      trailSlRef.current  = Math.max(pp.lockProfitAt, trailSlRef.current);
      setCurrentSl(trailSlRef.current);
    }

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
