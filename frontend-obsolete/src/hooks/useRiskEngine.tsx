import { useEffect, useRef } from "react";
import { usePnlStore } from "@/store/pnlStore";

export function useRiskEngine(onExitAll: () => void) {
  const { totalPnl, mtmStopLoss, trailing } = usePnlStore();

  const peakProfit = useRef(0);
  const currentTSL = useRef<number | null>(null);

  useEffect(() => {
    // MTM STOP LOSS
    if (totalPnl <= mtmStopLoss) {
      onExitAll();
      return;
    }

    if (!trailing.enabled) return;

    if (totalPnl >= trailing.activateAt) {
      peakProfit.current = Math.max(peakProfit.current, totalPnl);

      if (currentTSL.current === null) {
        currentTSL.current = trailing.lockAt;
      }

      const move = peakProfit.current - trailing.activateAt;

      const steps = Math.floor(move / trailing.profitStep);

      currentTSL.current = trailing.lockAt + steps * trailing.tslStep;

      if (totalPnl <= currentTSL.current) {
        onExitAll();
      }
    }
  }, [totalPnl, mtmStopLoss, trailing]);
}
