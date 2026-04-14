import { useState, memo } from "react";
import { cn } from "@/lib/utils";
import { getLotSize } from "@/lib/lot-sizes";
import { useOptionContractsStore, formatExpiryLabel } from "@/stores/option-contracts-store";
import { type QtyMode } from "./qty-input";
import { PositionActions } from "./position-actions";
import { OptionTypeBadge } from "./option-type-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { BrokerBadge } from "@/components/ui/broker-badge";
import {
  ConvertPositionDialog,
  AddStoplossDialog,
} from "./position-action-dialogs";
import { parseTradingSymbol } from "./trading-symbol";
import {
  OrderDialog,
  type OrderIntent,
} from "@/components/panels/order-dialog";
import type { Position } from "@/types";

const INR    = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const INR_INT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

const PRODUCT_LABEL: Record<string, string> = {
  Intraday:   "Intraday",
  Delivery:   "Delivery",
  Mtf:        "MTF",
  CoverOrder: "Cover Order",
};

export function PnlCell({ value, pct, noDecimal }: { value: number; pct?: number; noDecimal?: boolean }) {
  const color = value > 0 ? "text-emerald-500" : value < 0 ? "text-rose-500" : "text-muted-foreground";
  const fmt = noDecimal ? INR_INT : INR;
  return (
    <div className="flex flex-col items-end gap-0">
      <span className={cn("font-mono tabular-nums", color)}>
        {value >= 0 ? "+" : ""}₹{fmt.format(value)}
      </span>
      {pct !== undefined && (
        <span className={cn("font-mono text-[10px] tabular-nums opacity-60", color)}>
          {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

type DialogType = "exit" | "more" | "convert" | "stoploss" | null;

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
  onShiftUp: () => void;
  onShiftDown: () => void;
}

function buildOrderIntent(
  position: Position,
  transactionType: "Buy" | "Sell",
  getByInstrumentKey: (token: string, symbol?: string) => { contract: { strikePrice: number; instrumentType: "CE" | "PE"; expiry: string }; index: string } | undefined,
): OrderIntent {
  const lookup   = getByInstrumentKey(position.instrumentToken, position.tradingSymbol);
  const contract = lookup?.contract;
  const index    = lookup?.index;
  const parsed   = contract ? null : parseTradingSymbol(position.tradingSymbol);

  return {
    instrumentKey:   position.instrumentToken,
    side:            contract?.instrumentType ?? parsed?.type ?? "CE",
    transactionType,
    ltp:             position.ltp,
    strike:          contract?.strikePrice ?? Number(parsed?.strike ?? 0),
    underlying:      index ?? parsed?.index ?? position.tradingSymbol,
    expiry:          contract?.expiry,
  };
}

export const PositionRow = memo(function PositionRow({
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
  onShiftUp,
  onShiftDown,
}: PositionRowProps) {
  const [dialog, setDialog] = useState<DialogType>(null);

  const costBasis = Math.abs(p.quantity) * p.averagePrice;
  const toPct = (val: number) => costBasis > 0 ? (val / costBasis) * 100 : undefined;

  const lot = getLotSize(p.tradingSymbol);
  const num = parseInt(qtyValue, 10);
  const actualQty = isNaN(num) || num <= 0 ? 0 : qtyMode === "lot" ? num * lot : num;
  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);
  const lookup = getByInstrumentKey(p.instrumentToken, p.tradingSymbol);
  const contract = lookup?.contract;
  const index = lookup?.index;

  // OrderIntent for buy-more / sell-more / exit, constructed on demand
  const isSell = p.quantity < 0;
  const moreIntent   = dialog === "more"
    ? buildOrderIntent(p, isSell ? "Sell" : "Buy", getByInstrumentKey)
    : null;
  const exitIntent   = dialog === "exit"
    ? buildOrderIntent(p, isSell ? "Buy" : "Sell", getByInstrumentKey)
    : null;
  const activeIntent = moreIntent ?? exitIntent;

  // lockedProduct: only lock when it's a standard product type
  const lockedProduct: "Intraday" | "Delivery" | undefined =
    p.product === "Intraday" || p.product === "Delivery" ? p.product : undefined;

  // defaultQtyOverride: exit prefills full position qty; buy/sell more defaults to 1 lot
  const defaultQtyOverride = dialog === "exit"
    ? { value: Math.abs(p.quantity), mode: "qty" as const }
    : undefined;

  return (
    <>
      <tr
        className={cn(
          "border-b border-border/40 transition-colors hover:bg-muted/30 [&>td]:align-middle",
          p.quantity === 0 && "[&>td]:opacity-40",
          selected && "bg-primary/5",
          isNew && "animate-row-enter",
        )}
      >
        <td className={cn("pl-3 py-1.5 w-7", selected && "border-l-2 border-l-primary/50")}>
          <Checkbox checked={selected} disabled={p.quantity === 0} onCheckedChange={onToggleSelect} />
        </td>
        <td className="px-3 py-1.5">
          {contract ? (
            <>
              <div className="flex items-center gap-1.5 font-medium">
                {index} {contract.strikePrice}
                <OptionTypeBadge type={contract.instrumentType} />
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <BrokerBadge brokerId={p.broker ?? "upstox"} size={12} />
                {p.exchange} / {formatExpiryLabel(contract.expiry)}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">{p.tradingSymbol}</div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <BrokerBadge brokerId={p.broker ?? "upstox"} size={12} />
                {p.exchange}
              </div>
            </>
          )}
        </td>
        <td className="px-3 py-1.5 text-sm text-muted-foreground">
          {PRODUCT_LABEL[p.product] ?? p.product}
        </td>
        <td
          className={cn(
            "px-3 py-1.5 text-right font-mono tabular-nums font-semibold",
            p.quantity < 0 ? "text-rose-500" : "text-emerald-500",
          )}
        >
          {p.quantity > 0 ? "+" : ""}
          {p.quantity}
        </td>
        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
          ₹{INR.format(p.averagePrice)}
        </td>
        <td className="px-3 py-1.5 text-right font-mono tabular-nums">₹{INR.format(p.ltp)}</td>
        <td className="px-3 py-1.5 text-right">
          <PnlCell value={p.pnl} pct={toPct(p.pnl)} />
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
            isSell={isSell}
            onQtyChange={onQtyChange}
            onToggleMode={onToggleMode}
            onAdd={onAdd}
            onReduce={onReduce}
            onShiftUp={onShiftUp}
            onShiftDown={onShiftDown}
            onExitDialog={() => setDialog("exit")}
            onSellMore={() => setDialog("more")}
            onConvert={() => setDialog("convert")}
            onAddStoploss={() => setDialog("stoploss")}
          />
        </td>
      </tr>

      {/* Unified order dialog for buy-more / sell-more / exit */}
      <OrderDialog
        intent={activeIntent}
        currentLtp={p.ltp}
        onClose={() => setDialog(null)}
        lockedBroker={p.broker ?? "upstox"}
        lockedProduct={lockedProduct}
        hideDirectionToggle
        defaultQtyOverride={defaultQtyOverride}
      />

      {/* Other action dialogs — portal to document.body, safe inside <tr> */}
      <ConvertPositionDialog
        open={dialog === "convert"}
        onOpenChange={(open) => !open && setDialog(null)}
        position={p}
      />
      <AddStoplossDialog
        open={dialog === "stoploss"}
        onOpenChange={(open) => !open && setDialog(null)}
        position={p}
      />
    </>
  );
});
