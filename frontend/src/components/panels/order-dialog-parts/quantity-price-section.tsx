import { Pencil, X as XIcon } from "lucide-react";
import { QtyInput, type QtyMode } from "@/components/ui/qty-input";
import { cn } from "@/lib/utils";
import type { OrderType } from "./types";

interface QuantityPriceSectionProps {
  qtyValue: string;
  qtyMode: QtyMode;
  lotSize: number;
  orderType: OrderType;
  limitPrice: string;
  ltp: number;
  onQtyChange: (value: string) => void;
  onToggleQtyMode: () => void;
  onLimitPriceChange: (price: string) => void;
  onOrderTypeChange: (orderType: OrderType, limitPrice?: string) => void;
}

export function QuantityPriceSection({
  qtyValue,
  qtyMode,
  lotSize,
  orderType,
  limitPrice,
  ltp,
  onQtyChange,
  onToggleQtyMode,
  onLimitPriceChange,
  onOrderTypeChange,
}: QuantityPriceSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Lots</p>
        <QtyInput
          value={qtyValue}
          mode={qtyMode}
          lotSize={lotSize}
          onChange={onQtyChange}
          onToggleMode={onToggleQtyMode}
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          {orderType === "market" ? "Market price" : "Price"}
        </p>
        <div className="flex h-9 overflow-hidden rounded border border-border bg-background">
          <div
            className={cn(
              "flex flex-1 items-center px-3",
              orderType === "market" && "bg-[repeating-linear-gradient(-45deg,rgb(255_255_255_/_0.06)_0px,rgb(255_255_255_/_0.06)_1px,transparent_1px,transparent_8px)]",
            )}
          >
            <input
              type="number"
              step="0.05"
              min="0"
              value={orderType === "market" ? "0" : limitPrice}
              onChange={(event) => onLimitPriceChange(event.target.value)}
              disabled={orderType === "market"}
              className="w-full bg-transparent text-sm font-mono tabular-nums outline-none disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
          <button
            onClick={() => {
              if (orderType === "market") {
                onOrderTypeChange("limit", ltp.toFixed(2));
              } else {
                onOrderTypeChange("market");
              }
            }}
            className="flex w-9 shrink-0 items-center justify-center border-l border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {orderType === "market" ? <Pencil className="size-3.5" /> : <XIcon className="size-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

