import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { RefreshCw, ArrowRight, Zap, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QtyInput, type QtyMode } from "@/components/ui/qty-input";
import { OptionTypeBadge } from "./option-type-badge";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { getLotSize } from "@/lib/lot-sizes";
import { cn } from "@/lib/utils";
import { convertPosition, placeStoplossOrder } from "@/services/trading-api";
import type { Position } from "@/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function isIntraday(product: string) {
  return product === "Intraday";
}

function productLabel(product: string) {
  return isIntraday(product) ? "Intraday" : "Delivery";
}

function useQtyState(initialQty: number, open: boolean, lotSize: number) {
  const [qtyValue, setQtyValue] = useState(String(initialQty));
  const [qtyMode, setQtyMode]   = useState<QtyMode>("qty");

  useEffect(() => {
    if (open) {
      setQtyValue(String(initialQty));
      setQtyMode("qty");
    }
  }, [open, initialQty]);

  const toggleQtyMode = () => {
    setQtyMode((prev) => {
      const next: QtyMode = prev === "lot" ? "qty" : "lot";
      const cur = parseInt(qtyValue, 10);
      if (!isNaN(cur) && cur > 0) {
        setQtyValue(
          next === "qty"
            ? String(cur * lotSize)
            : String(Math.max(1, Math.round(cur / lotSize))),
        );
      }
      return next;
    });
  };

  const num = parseInt(qtyValue, 10);
  const qty = isNaN(num) || num <= 0 ? 0 : qtyMode === "lot" ? num * lotSize : num;

  return { qtyValue, setQtyValue, qtyMode, toggleQtyMode, qty };
}

// ── Symbol formatting fallback ────────────────────────────────────────────────

export const INDEX_PREFIXES = ["BANKNIFTY", "FINNIFTY", "SENSEX", "BANKEX", "NIFTY"];

export function parseTradingSymbol(symbol: string) {
  const upper = symbol.toUpperCase();
  const type  = upper.endsWith("CE") ? "CE" : upper.endsWith("PE") ? "PE" : null;
  if (!type) return null;
  const without = upper.slice(0, -2);
  const index   = INDEX_PREFIXES.find((i) => without.startsWith(i));
  if (!index) return null;
  const strike  = without.match(/(\d+)$/)?.[1];
  if (!strike) return null;
  return { index, strike, type: type as "CE" | "PE" };
}

// ── Symbol chip (no LTP — shown in the order-type row below) ─────────────────

function SymbolChip({ position }: { position: Position }) {
  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);
  const lookup   = getByInstrumentKey(position.instrumentToken);
  const contract = lookup?.contract;
  const index    = lookup?.index;
  const parsed   = contract ? null : parseTradingSymbol(position.tradingSymbol);

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

// ── Convert Position Dialog ───────────────────────────────────────────────────

interface ConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: Position;
}

// ── Add Stoploss Dialog ───────────────────────────────────────────────────────

interface AddStoplossDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: Position;
}

export function AddStoplossDialog({ open, onOpenChange, position }: AddStoplossDialogProps) {
  // SLM: opposite direction of position (short → Buy to exit, long → Sell to exit)
  const isSell  = position.quantity < 0;
  const txn: "Buy" | "Sell" = isSell ? "Buy" : "Sell";
  const lotSize = getLotSize(position.tradingSymbol);
  const { qtyValue, setQtyValue, qtyMode, toggleQtyMode, qty } = useQtyState(
    Math.abs(position.quantity),
    open,
    lotSize,
  );
  const [triggerPrice, setTriggerPrice] = useState("");
  const [placing, setPlacing] = useState(false);
  const ltpSnapped = useRef(false);

  useEffect(() => {
    if (open) {
      setTriggerPrice(position.ltp.toFixed(2));
      ltpSnapped.current = true;
      setPlacing(false);
    } else {
      ltpSnapped.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canConfirm = qty > 0 && !!triggerPrice && parseFloat(triggerPrice) > 0;

  async function handleConfirm() {
    setPlacing(true);
    try {
      await placeStoplossOrder(
        position.instrumentToken,
        qty,
        txn,
        position.product,
        parseFloat(triggerPrice),
        position.broker ?? "upstox",
        position.exchange,
      );
      toast.success("Stoploss order placed");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
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
                onChange={(e) => setTriggerPrice(e.target.value)}
                className="h-9 font-mono text-sm"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quantity
              </p>
              <QtyInput
                value={qtyValue}
                mode={qtyMode}
                lotSize={lotSize}
                onChange={setQtyValue}
                onToggleMode={toggleQtyMode}
              />
            </div>
          </div>

          <Button
            disabled={!canConfirm || placing}
            onClick={handleConfirm}
            className="h-11 w-full text-base font-bold bg-amber-600 hover:bg-amber-700 text-white"
          >
            {placing ? (
              <><Zap className="mr-2 size-4 animate-pulse" />Placing…</>
            ) : (
              `Place SL-M ${txn} ${qty} qty`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ConvertPositionDialog({ open, onOpenChange, position }: ConvertDialogProps) {
  const lotSize   = getLotSize(position.tradingSymbol);
  const fromLabel = productLabel(position.product);
  const toLabel   = isIntraday(position.product) ? "Delivery" : "Intraday";

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
    } catch (e) {
      toast.error((e as Error).message);
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

          {/* From → To */}
          <div className="flex items-center justify-center gap-3 rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
            <span className="rounded-md border border-border/50 bg-muted/30 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {fromLabel}
            </span>
            <ArrowRight className="size-4 text-muted-foreground/50" />
            <span className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {toLabel}
            </span>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quantity
            </p>
            <QtyInput
              value={qtyValue}
              mode={qtyMode}
              lotSize={lotSize}
              onChange={setQtyValue}
              onToggleMode={toggleQtyMode}
            />
          </div>

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
