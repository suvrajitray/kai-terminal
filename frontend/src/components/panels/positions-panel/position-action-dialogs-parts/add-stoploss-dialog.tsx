import { useEffect, useRef, useState } from "react";
import { ShieldAlert, Zap } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getLotSize } from "@/lib/lot-sizes";
import { placeStoplossOrder } from "@/services/trading-api";
import { QuantityField, SymbolChip } from "./dialog-utils";
import { useQtyState } from "./dialog-state";
import type { Position } from "@/types";

interface AddStoplossDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: Position;
}

export function AddStoplossDialog({ open, onOpenChange, position }: AddStoplossDialogProps) {
  const transactionType: "Buy" | "Sell" = position.quantity < 0 ? "Buy" : "Sell";
  const lotSize = getLotSize(position.tradingSymbol);
  const { qtyValue, setQtyValue, qtyMode, toggleQtyMode, qty } = useQtyState(
    Math.abs(position.quantity),
    open,
    lotSize,
  );
  const [triggerPrice, setTriggerPrice] = useState("");
  const [placing, setPlacing] = useState(false);
  const latestClosedLtp = useRef(position.ltp);

  useEffect(() => {
    if (!open) {
      latestClosedLtp.current = position.ltp;
    }
  }, [open, position.ltp]);

  useEffect(() => {
    if (open) {
      setTriggerPrice(latestClosedLtp.current.toFixed(2));
      setPlacing(false);
    }
  }, [open]);

  const canConfirm = qty > 0 && !!triggerPrice && parseFloat(triggerPrice) > 0;

  async function handleConfirm() {
    setPlacing(true);
    try {
      await placeStoplossOrder(
        position.instrumentToken,
        qty,
        transactionType,
        position.product,
        parseFloat(triggerPrice),
        position.broker ?? "upstox",
        position.exchange,
      );
      toast.success("Stoploss order placed");
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-400">
            <ShieldAlert className="size-4" />
            Add Stoploss
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <SymbolChip position={position} />

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              LTP <span className="font-mono font-semibold text-foreground">{position.ltp.toFixed(2)}</span>
            </span>
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
              SL-Market
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Trigger Price
              </p>
              <Input
                type="number"
                step="0.05"
                min="0"
                value={triggerPrice}
                onChange={(event) => setTriggerPrice(event.target.value)}
                className="h-9 font-mono text-sm"
                autoFocus
              />
            </div>
            <QuantityField
              qtyValue={qtyValue}
              qtyMode={qtyMode}
              lotSize={lotSize}
              onQtyChange={setQtyValue}
              onToggleQtyMode={toggleQtyMode}
            />
          </div>

          <Button
            disabled={!canConfirm || placing}
            onClick={handleConfirm}
            className="h-11 w-full text-base font-bold bg-amber-600 hover:bg-amber-700 text-white"
          >
            {placing ? (
              <><Zap className="mr-2 size-4 animate-pulse" />Placing…</>
            ) : (
              `Place SL-M ${transactionType} ${qty} qty`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
