import { useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getLotSize } from "@/lib/lot-sizes";
import { convertPosition } from "@/services/trading-api";
import { QuantityField, SymbolChip } from "./dialog-utils";
import { isIntraday, productLabel, useQtyState } from "./dialog-state";
import type { Position } from "@/types";

interface ConvertPositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: Position;
}

export function ConvertPositionDialog({ open, onOpenChange, position }: ConvertPositionDialogProps) {
  const lotSize = getLotSize(position.tradingSymbol);
  const fromLabel = productLabel(position.product);
  const toLabel = isIntraday(position.product) ? "Delivery" : "Intraday";
  const [converting, setConverting] = useState(false);
  const { qtyValue, setQtyValue, qtyMode, toggleQtyMode, qty } = useQtyState(
    Math.abs(position.quantity),
    open,
    lotSize,
  );

  async function handleConfirm() {
    setConverting(true);
    try {
      await convertPosition(position.instrumentToken, position.product, qty, position.broker ?? "upstox");
      toast.success(`Converted ${qty} units to ${toLabel}`);
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setConverting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="size-4 text-muted-foreground" />
            Convert Position
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <SymbolChip position={position} />

          <div className="flex items-center justify-center gap-3 rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
            <span className="rounded-md border border-border/50 bg-muted/30 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {fromLabel}
            </span>
            <ArrowRight className="size-4 text-muted-foreground/50" />
            <span className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {toLabel}
            </span>
          </div>

          <QuantityField
            qtyValue={qtyValue}
            qtyMode={qtyMode}
            lotSize={lotSize}
            onQtyChange={setQtyValue}
            onToggleQtyMode={toggleQtyMode}
          />

          <Button
            disabled={qty === 0 || converting}
            onClick={handleConfirm}
            className="h-11 w-full text-base font-bold"
          >
            <RefreshCw className={cn("size-4", converting && "animate-spin")} />
            {converting ? "Converting…" : `Convert to ${toLabel}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
