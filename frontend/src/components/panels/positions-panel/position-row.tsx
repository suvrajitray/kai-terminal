import { useState } from "react";
import { cn } from "@/lib/utils";
import { getLotSize } from "@/lib/lot-sizes";
import { useOptionContractsStore, formatExpiryLabel } from "@/stores/option-contracts-store";
import { type QtyMode } from "./qty-input";
import { PositionActions } from "./position-actions";
import { OptionTypeBadge } from "./option-type-badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ExitPositionDialog,
  SellBuyMoreDialog,
  ConvertPositionDialog,
} from "./position-action-dialogs";
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

type DialogType = "exit" | "more" | "convert" | null;

interface PositionRowProps {
  position: Position;
  qtyValue: string;
  qtyMode: QtyMode;
  acting: string | null;
  selected: boolean;
  isNew?: boolean;
  onToggleSelect: () => void;
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
  selected,
  isNew,
  onToggleSelect,
  onQtyChange,
  onToggleMode,
  onAdd,
  onReduce,
  onExit,
  onShiftUp,
  onShiftDown,
}: PositionRowProps) {
  const [dialog, setDialog] = useState<DialogType>(null);

  const lot = getLotSize(p.trading_symbol);
  const num = parseInt(qtyValue, 10);
  const actualQty = isNaN(num) || num <= 0 ? 0 : qtyMode === "lot" ? num * lot : num;
  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);
  const contract = getByInstrumentKey(p.instrument_token);

  return (
    <>
      <tr
        className={cn(
          "border-b border-border/40 transition-colors hover:bg-muted/30 [&>td]:align-middle",
          p.quantity === 0 && "opacity-50",
          selected && "bg-primary/5",
          isNew && "animate-row-enter",
        )}
      >
        <td className="pl-3 py-1.5 w-7">
          <Checkbox checked={selected} disabled={p.quantity === 0} onCheckedChange={onToggleSelect} />
        </td>
        <td className="px-3 py-1.5">
          {contract ? (
            <>
              <div className="flex items-center gap-1.5 font-medium">
                {contract.underlying_symbol} {contract.strike_price}
                <OptionTypeBadge type={contract.instrument_type} />
              </div>
              <div className="text-[11px] text-muted-foreground">
                {p.exchange} {formatExpiryLabel(contract.expiry)}
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
          ₹{INR.format(p.quantity < 0 ? p.sell_price : p.buy_price)}
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
        <td className="px-3 py-1.5 text-right">
          <PositionActions
            qtyValue={qtyValue}
            qtyMode={qtyMode}
            multiplier={lot}
            actualQty={actualQty}
            positionQty={Math.abs(p.quantity)}
            acting={acting}
            hasOpenQty={p.quantity !== 0}
            isSell={p.quantity < 0}
            onQtyChange={onQtyChange}
            onToggleMode={onToggleMode}
            onAdd={onAdd}
            onReduce={onReduce}
            onShiftUp={onShiftUp}
            onShiftDown={onShiftDown}
            onExit={() => setDialog("exit")}
            onSellMore={() => setDialog("more")}
            onConvert={() => setDialog("convert")}
          />
        </td>
      </tr>

      {/* Action dialogs — portal to document.body, safe inside <tr> */}
      <ExitPositionDialog
        open={dialog === "exit"}
        onOpenChange={(open) => !open && setDialog(null)}
        position={p}
        onConfirm={onExit}
      />
      <SellBuyMoreDialog
        open={dialog === "more"}
        onOpenChange={(open) => !open && setDialog(null)}
        position={p}
      />
      <ConvertPositionDialog
        open={dialog === "convert"}
        onOpenChange={(open) => !open && setDialog(null)}
        position={p}
      />
    </>
  );
}
