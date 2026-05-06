import { ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveBroker, OrderAccent, ProductType, SupportedBroker } from "./types";

interface BrokerRoutingSectionProps {
  lockedBroker?: string;
  activeBrokers: ActiveBroker[];
  broker: SupportedBroker;
  brokerLabel: string;
  product: ProductType;
  accent: OrderAccent;
  onBrokerChange: (broker: SupportedBroker) => void;
  onProductChange: (product: ProductType) => void;
}

export function BrokerRoutingSection({
  lockedBroker,
  activeBrokers,
  broker,
  brokerLabel,
  product,
  accent,
  onBrokerChange,
  onProductChange,
}: BrokerRoutingSectionProps) {
  if (lockedBroker) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Product</span>
        <span className="rounded border border-border/40 bg-muted/30 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {product} ({product === "Intraday" ? "MIS" : "NRML"})
        </span>
        <span className="text-muted-foreground/50">via {brokerLabel}</span>
      </div>
    );
  }

  return (
    <>
      {activeBrokers.length > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowRightLeft className="size-3.5" />
            <span>Route via</span>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border/40 bg-background p-0.5">
            {activeBrokers.map((activeBroker) => (
              <button
                key={activeBroker.id}
                onClick={() => onBrokerChange(activeBroker.id as SupportedBroker)}
                className={cn(
                  "cursor-pointer rounded px-3 py-1 text-xs font-semibold transition-all",
                  broker === activeBroker.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {activeBroker.id === "upstox" ? "Upstox" : "Zerodha"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-6">
        {(["Intraday", "Delivery"] as const).map((productType) => (
          <button
            key={productType}
            onClick={() => onProductChange(productType)}
            className="flex items-center gap-2 group"
          >
            <span
              className={cn(
                "size-4 rounded-full border-2 flex items-center justify-center transition-colors",
                product === productType ? accent.border : "border-muted-foreground/30 group-hover:border-muted-foreground/50",
              )}
            >
              {product === productType && <span className={cn("size-2 rounded-full", accent.dot)} />}
            </span>
            <span className={cn("text-sm font-medium transition-colors", product === productType ? "text-foreground" : "text-muted-foreground")}>
              {productType}
            </span>
            <span className="text-[11px] text-muted-foreground/50">
              {productType === "Intraday" ? "MIS" : "NRML"}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

