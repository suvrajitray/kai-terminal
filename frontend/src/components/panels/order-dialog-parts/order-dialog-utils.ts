import type { OrderAccent, OrderDirection } from "./types";

export function getOrderAccent(direction: OrderDirection): OrderAccent {
  return direction === "Buy"
    ? { border: "border-green-500", dot: "bg-green-500", btn: "bg-green-600 hover:bg-green-700", toggle: "bg-green-600" }
    : { border: "border-red-500", dot: "bg-red-500", btn: "bg-red-600 hover:bg-red-700", toggle: "bg-red-600" };
}

export function getOrderQuantity({
  qtyValue,
  qtyMode,
  lotSize,
}: {
  qtyValue: string;
  qtyMode: "qty" | "lot";
  lotSize: number;
}) {
  const parsed = parseInt(qtyValue, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return lotSize;
  return qtyMode === "lot" ? parsed * lotSize : parsed;
}

export function getMarginColor({
  margin,
  availableMargin,
}: {
  margin: number | null;
  availableMargin: number | null;
}) {
  if (margin == null || availableMargin == null) return "text-foreground";
  if (margin > availableMargin) return "text-rose-400";
  if (availableMargin < margin * 1.15) return "text-amber-400";
  return "text-foreground";
}

