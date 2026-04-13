import React from "react";
import { cn } from "@/lib/utils";
import { QtyInput, type QtyMode } from "@/components/ui/qty-input";

type Direction = "Buy" | "Sell";

interface ChainControlsProps {
  qtyValue: string;
  qtyMode: QtyMode;
  lotSize: number;
  direction: Direction;
  margin: number | null;
  marginLoading: boolean;
  onQtyChange: (v: string) => void;
  onToggleMode: () => void;
  onDirectionChange: (d: Direction) => void;
}

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export const ChainControls = React.memo(function ChainControls({
  qtyValue,
  qtyMode,
  lotSize,
  direction,
  margin,
  marginLoading,
  onQtyChange,
  onToggleMode,
  onDirectionChange,
}: ChainControlsProps) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "1fr auto auto" }}>
      <QtyInput
        value={qtyValue}
        mode={qtyMode}
        lotSize={lotSize}
        onChange={onQtyChange}
        onToggleMode={onToggleMode}
      />

      <div className="flex h-9 w-24 items-center gap-1 rounded-lg border border-border/40 bg-muted/20 p-1">
        {(["Buy", "Sell"] as Direction[]).map((d) => (
          <button
            key={d}
            onClick={() => onDirectionChange(d)}
            className={cn(
              "flex-1 h-full rounded-md text-xs font-semibold transition-all",
              direction === d
                ? d === "Buy"
                  ? "bg-green-600 text-white shadow-sm"
                  : "bg-red-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex h-9 w-38 items-center justify-between rounded-lg border border-border/30 bg-muted/10 px-3 text-xs">
        <span className="text-muted-foreground">Margin</span>
        {marginLoading ? (
          <span className="animate-pulse text-muted-foreground/60 tabular-nums">…</span>
        ) : margin != null ? (
          <span className="font-semibold tabular-nums">₹{INR.format(margin)}</span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </div>
    </div>
  );
});
