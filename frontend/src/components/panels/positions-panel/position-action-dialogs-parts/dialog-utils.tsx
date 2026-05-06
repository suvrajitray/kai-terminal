import { QtyInput, type QtyMode } from "@/components/ui/qty-input";
import { cn } from "@/lib/utils";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { OptionTypeBadge } from "../option-type-badge";
import { parseTradingSymbol } from "../trading-symbol";
import type { Position } from "@/types";

export function SymbolChip({ position }: { position: Position }) {
  const getByInstrumentKey = useOptionContractsStore((state) => state.getByInstrumentKey);
  const lookup = getByInstrumentKey(position.instrumentToken);
  const contract = lookup?.contract;
  const index = lookup?.index;
  const parsed = contract ? null : parseTradingSymbol(position.tradingSymbol);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
      {contract ? (
        <>
          <span className="font-semibold text-sm">{index} {contract.strikePrice}</span>
          <OptionTypeBadge type={contract.instrumentType} />
        </>
      ) : parsed ? (
        <>
          <span className="font-semibold text-sm">{parsed.index} {parsed.strike}</span>
          <OptionTypeBadge type={parsed.type} />
        </>
      ) : (
        <span className="font-semibold text-sm truncate">{position.tradingSymbol}</span>
      )}
      <span className="text-[11px] text-muted-foreground">{position.exchange}</span>
      <span className={cn("ml-auto font-semibold tabular-nums text-sm", position.quantity < 0 ? "text-rose-400" : "text-emerald-400")}>
        {position.quantity > 0 ? "+" : ""}{position.quantity} qty
      </span>
    </div>
  );
}

export function QuantityField({
  qtyValue,
  qtyMode,
  lotSize,
  onQtyChange,
  onToggleQtyMode,
}: {
  qtyValue: string;
  qtyMode: QtyMode;
  lotSize: number;
  onQtyChange: (value: string) => void;
  onToggleQtyMode: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Quantity
      </p>
      <QtyInput
        value={qtyValue}
        mode={qtyMode}
        lotSize={lotSize}
        onChange={onQtyChange}
        onToggleMode={onToggleQtyMode}
      />
    </div>
  );
}
