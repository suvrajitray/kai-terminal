import { useCallback, useState } from "react";
import { getLotSize } from "@/lib/lot-sizes";
import type { Position } from "@/types";
import type { QtyMode } from "./qty-input";

export function usePositionQuantities(positions: Position[]) {
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [qtyMode, setQtyMode] = useState<QtyMode>("qty");

  const setQty = useCallback((token: string, value: string) => {
    setQtys((prev) => ({ ...prev, [token]: value }));
  }, []);

  const toggleMode = useCallback(() => {
    setQtyMode((prevMode) => {
      const nextMode: QtyMode = prevMode === "qty" ? "lot" : "qty";
      setQtys((prev) => {
        const next: Record<string, string> = {};

        for (const position of positions) {
          const lot = getLotSize(position.tradingSymbol);
          const raw = parseInt(prev[position.instrumentToken] ?? "", 10);

          if (Number.isNaN(raw) || raw <= 0) {
            next[position.instrumentToken] = "";
            continue;
          }

          next[position.instrumentToken] =
            nextMode === "lot"
              ? String(Math.max(1, Math.round(raw / lot)))
              : String(raw * lot);
        }

        return next;
      });
      return nextMode;
    });
  }, [positions]);

  const resolveQty = useCallback((token: string, tradingSymbol: string) => {
    const lot = getLotSize(tradingSymbol);
    const num = parseInt(qtys[token] ?? "", 10);
    if (Number.isNaN(num) || num <= 0) return 0;
    return qtyMode === "lot" ? num * lot : num;
  }, [qtyMode, qtys]);

  return { qtys, qtyMode, setQty, toggleMode, resolveQty };
}

