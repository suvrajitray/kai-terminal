import { cn } from "@/lib/utils";
import { getLotSize } from "@/lib/lot-sizes";
import { parseTradingSymbol } from "@/lib/parse-trading-symbol";
import { type QtyMode } from "./qty-input";
import { PositionActions } from "./position-actions";
import type { Position } from "@/types";

const INR = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 });

const PRODUCT_LABEL: Record<string, string> = {
  I: "Intraday",
  D: "Delivery",
  NRML: "Delivery",
  MIS: "Intraday",
  MTF: "MTF",
  CO: "Cover",
};

export function PnlCell({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        value > 0 ? "text-green-500" : value < 0 ? "text-red-500" : "text-muted-foreground",
      )}
    >
      {value >= 0 ? "+" : ""}₹{INR.format(value)}
    </span>
  );
}

interface PositionRowProps {
  position: Position;
  qtyValue: string;
  qtyMode: QtyMode;
  acting: string | null;
  onQtyChange: (v: string) => void;
  onToggleMode: () => void;
  onAdd: () => void;
  onReduce: () => void;
  onExit: () => void;
  onShiftUp: () => void;
  onShiftDown: () => void;
}

export function PositionRow({
  position: p,
  qtyValue,
  qtyMode,
  acting,
  onQtyChange,
  onToggleMode,
  onAdd,
  onReduce,
  onExit,
  onShiftUp,
  onShiftDown,
}: PositionRowProps) {
  const lot = getLotSize(p.trading_symbol);
  const num = parseInt(qtyValue, 10);
  const actualQty = isNaN(num) || num <= 0 ? 0 : qtyMode === "lot" ? num * lot : num;
  const parsed = parseTradingSymbol(p.trading_symbol);

  return (
    <tr
      className={cn(
        "border-b border-border/40 transition-colors hover:bg-muted/30 align-middle",
        p.quantity === 0 && "opacity-50",
      )}
    >
      <td className="px-3 py-1.5">
        {parsed ? (
          <>
            <div className="font-medium">{parsed.label}</div>
            <div className="text-[11px] text-muted-foreground">
              {p.exchange} {parsed.expiryLabel}
            </div>
          </>
        ) : (
          <>
            <div className="font-medium">{p.trading_symbol}</div>
            <div className="text-[11px] text-muted-foreground">{p.exchange}</div>
          </>
        )}
      </td>
      <td className="px-3 py-1.5 text-sm text-muted-foreground">
        {PRODUCT_LABEL[p.product.toUpperCase()] ?? p.product}
      </td>
      <td
        className={cn(
          "px-3 py-1.5 text-right tabular-nums font-semibold",
          p.quantity < 0 ? "text-red-500" : "text-green-500",
        )}
      >
        {p.quantity > 0 ? "+" : ""}
        {p.quantity}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
        ₹{INR.format(p.average_price !== 0 ? p.average_price : p.quantity < 0 ? p.sell_price : p.buy_price)}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums">₹{INR.format(p.last_price)}</td>
      <td className="px-3 py-1.5 text-right">
        <PnlCell value={p.pnl} />
      </td>
      <td className="px-3 py-1.5 text-right">
        <PnlCell value={p.unrealised} />
      </td>
      <td className="px-3 py-1.5 text-right">
        <PnlCell value={p.realised} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <PositionActions
          qtyValue={qtyValue}
          qtyMode={qtyMode}
          multiplier={lot}
          actualQty={actualQty}
          acting={acting}
          hasOpenQty={p.quantity !== 0}
          onQtyChange={onQtyChange}
          onToggleMode={onToggleMode}
          onAdd={onAdd}
          onReduce={onReduce}
          onShiftUp={onShiftUp}
          onShiftDown={onShiftDown}
          onExit={onExit}
        />
      </td>
    </tr>
  );
}
