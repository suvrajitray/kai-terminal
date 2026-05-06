import { useEffect, useState } from "react";
import type { QtyMode } from "@/components/ui/qty-input";

export function isIntraday(product: string) {
  return product === "Intraday";
}

export function productLabel(product: string) {
  return isIntraday(product) ? "Intraday" : "Delivery";
}

export function useQtyState(initialQty: number, open: boolean, lotSize: number) {
  const [qtyValue, setQtyValue] = useState(String(initialQty));
  const [qtyMode, setQtyMode] = useState<QtyMode>("qty");

  useEffect(() => {
    if (!open) return;

    const resetId = setTimeout(() => {
      setQtyValue(String(initialQty));
      setQtyMode("qty");
    }, 0);

    return () => clearTimeout(resetId);
  }, [initialQty, open]);

  const toggleQtyMode = () => {
    setQtyMode((prev) => {
      const next: QtyMode = prev === "lot" ? "qty" : "lot";
      const current = parseInt(qtyValue, 10);

      if (!Number.isNaN(current) && current > 0) {
        setQtyValue(
          next === "qty"
            ? String(current * lotSize)
            : String(Math.max(1, Math.round(current / lotSize))),
        );
      }

      return next;
    });
  };

  const parsed = parseInt(qtyValue, 10);
  const qty = Number.isNaN(parsed) || parsed <= 0 ? 0 : qtyMode === "lot" ? parsed * lotSize : parsed;

  return { qtyValue, setQtyValue, qtyMode, toggleQtyMode, qty };
}

