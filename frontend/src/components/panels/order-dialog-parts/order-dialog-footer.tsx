import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrderAccent, OrderDirection } from "./types";

interface OrderDialogFooterProps {
  direction: OrderDirection;
  accent: OrderAccent;
  placing: boolean;
  margin: number | null;
  marginLoading: boolean;
  marginColor: string;
  availableMargin: number | null;
  onPlace: () => void;
  onClose: () => void;
}

export function OrderDialogFooter({
  direction,
  accent,
  placing,
  margin,
  marginLoading,
  marginColor,
  availableMargin,
  onPlace,
  onClose,
}: OrderDialogFooterProps) {
  return (
    <>
      <div className="h-px bg-border/40" />
      <div className="flex items-center gap-4 px-5 py-3">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-[11px] text-muted-foreground">
            Required{" "}
            {marginLoading ? (
              <span className="font-mono animate-pulse">—</span>
            ) : margin != null ? (
              <span className={cn("font-mono font-semibold tabular-nums", marginColor)}>
                ₹{margin.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            ) : (
              <span className="font-mono text-muted-foreground/40">—</span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Available{" "}
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {availableMargin != null
                ? `₹${availableMargin.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                : "—"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            className={cn("h-10 w-24 font-bold text-white uppercase tracking-wide", accent.btn)}
            onClick={onPlace}
            disabled={placing}
          >
            {placing ? (
              <><Zap className="mr-1.5 size-4 animate-pulse" />Placing…</>
            ) : (
              direction.toUpperCase()
            )}
          </Button>
          <Button variant="outline" className="h-10 w-24" onClick={onClose} disabled={placing}>
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}

