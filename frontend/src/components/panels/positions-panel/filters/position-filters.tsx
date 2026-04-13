import { memo } from "react";
import { cn } from "@/lib/utils";
import { BrokerBadge } from "@/components/ui/broker-badge";

interface PositionFiltersProps {
  brokerFilter: string | null;
  setBrokerFilter: (b: string | null) => void;
  productFilter: "Intraday" | "Delivery" | null;
  onProductFilterChange: (v: "Intraday" | "Delivery" | null) => void;
  brokersInPositions: string[];
  filteredMtmByBroker: Record<string, number>;
  showBrokerFilter: boolean;
  showProductFilter: boolean;
}

export const PositionFilters = memo(function PositionFilters({
  brokerFilter,
  setBrokerFilter,
  productFilter,
  onProductFilterChange,
  brokersInPositions,
  filteredMtmByBroker,
  showBrokerFilter,
  showProductFilter,
}: PositionFiltersProps) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/40 bg-muted/20 px-3">
      {showBrokerFilter && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setBrokerFilter(null)}
            className={cn(
              "cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
              brokerFilter === null
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {brokersInPositions.map((bId) => {
            const pnl = filteredMtmByBroker[bId];
            return (
              <button
                key={bId}
                onClick={() => setBrokerFilter(brokerFilter === bId ? null : bId)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                  brokerFilter === bId
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <BrokerBadge brokerId={bId} size={12} />
                {bId.charAt(0).toUpperCase() + bId.slice(1)}
                {pnl !== undefined && (
                  <span className={cn("font-mono tabular-nums", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {pnl >= 0 ? "+" : "-"}₹{Math.abs(pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {showBrokerFilter && showProductFilter && (
        <span className="text-border/60">|</span>
      )}

      {showProductFilter && (
        <div className="flex items-center gap-1">
          {([null, "Intraday", "Delivery"] as const).map((val) => (
            <button
              key={val ?? "all"}
              onClick={() => onProductFilterChange(val)}
              className={cn(
                "cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                productFilter === val
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {val === null ? "All" : val === "Intraday" ? "Intraday" : "Delivery"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
