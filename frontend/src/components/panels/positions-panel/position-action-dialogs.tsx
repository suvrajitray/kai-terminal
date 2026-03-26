import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, TrendingUp, TrendingDown, RefreshCw, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QuickTradeQtyInput, type QtyMode } from "@/components/layout/quick-trade-qty-input";
import { OptionTypeBadge } from "./option-type-badge";
import { useOptionContractsStore, formatExpiryLabel } from "@/stores/option-contracts-store";
import { getLotSize } from "@/lib/lot-sizes";
import { cn } from "@/lib/utils";
import { convertPosition, placeOrder } from "@/services/trading-api";
import type { Position } from "@/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

type OrderMode = "market" | "limit";

const INR = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 });

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

// ── Symbol chip with contract formatting + LTP ───────────────────────────────

function SymbolChip({ position }: { position: Position }) {
  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);
  const lookup = getByInstrumentKey(position.instrumentToken);
  const contract = lookup?.contract;
  const index = lookup?.index;

  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5 space-y-1.5">
      {/* Primary row: symbol + LTP */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          {contract ? (
            <>
              <span className="font-semibold text-sm">
                {index} {contract.strikePrice}
              </span>
              <OptionTypeBadge type={contract.instrumentType} />
            </>
          ) : (
            <span className="font-semibold text-sm truncate">{position.tradingSymbol}</span>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold tabular-nums">₹{INR.format(position.ltp)}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">LTP</div>
        </div>
      </div>

      {/* Secondary row: expiry + exchange + qty */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        {contract && (
          <>
            <span>{formatExpiryLabel(contract.expiry)}</span>
            <span className="text-border/50">·</span>
          </>
        )}
        <span>{position.exchange}</span>
        <span
          className={cn(
            "ml-auto font-semibold tabular-nums",
            position.quantity < 0 ? "text-red-400" : "text-green-400",
          )}
        >
          {position.quantity > 0 ? "+" : ""}
          {position.quantity} qty
        </span>
      </div>
    </div>
  );
}

// ── Order mode toggle ─────────────────────────────────────────────────────────

function OrderModeToggle({
  value,
  onChange,
}: {
  value: OrderMode;
  onChange: (v: OrderMode) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Order Type</Label>
      <div className="flex gap-1.5">
        {(["limit", "market"] as OrderMode[]).map((m) => (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={cn(
              "flex-1 rounded py-1.5 text-xs font-semibold capitalize transition-colors border",
              value === m
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

function LimitPriceInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Limit Price</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          ₹
        </span>
        <Input
          type="number"
          min={0}
          step={0.05}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-7 h-9 text-sm"
          placeholder="0.00"
        />
      </div>
    </div>
  );
}

// ── Exit Position Dialog ──────────────────────────────────────────────────────

interface ExitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: Position;
  onConfirm: () => void;
}

export function ExitPositionDialog({
  open,
  onOpenChange,
  position,
  onConfirm,
}: ExitDialogProps) {
  const lotSize = getLotSize(position.tradingSymbol);
  const { qtyValue, setQtyValue, qtyMode, toggleQtyMode, qty } = useQtyState(
    Math.abs(position.quantity),
    open,
    lotSize,
  );
  const [orderMode, setOrderMode] = useState<OrderMode>("limit");
  const [limitPrice, setLimitPrice] = useState("");

  useEffect(() => {
    if (open) {
      setOrderMode("limit");
      setLimitPrice("");
    }
  }, [open]);

  const canConfirm =
    qty > 0 && (orderMode === "market" || (!!limitPrice && parseFloat(limitPrice) > 0));

  function handleConfirm() {
    onConfirm();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="size-4 text-red-400" />
            Exit Position
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <SymbolChip position={position} />

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quantity</Label>
            <QuickTradeQtyInput
              value={qtyValue}
              mode={qtyMode}
              lotSize={lotSize}
              onChange={setQtyValue}
              onToggleMode={toggleQtyMode}
            />
          </div>

          <OrderModeToggle value={orderMode} onChange={setOrderMode} />

          {orderMode === "limit" && (
            <LimitPriceInput value={limitPrice} onChange={setLimitPrice} />
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Exit Position
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sell More / Buy More Dialog ───────────────────────────────────────────────

interface MoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: Position;
}

export function SellBuyMoreDialog({ open, onOpenChange, position }: MoreDialogProps) {
  const isSell  = position.quantity < 0;
  const lotSize = getLotSize(position.tradingSymbol);
  const { qtyValue, setQtyValue, qtyMode, toggleQtyMode, qty } = useQtyState(
    Math.abs(position.quantity),
    open,
    lotSize,
  );
  const [orderMode, setOrderMode] = useState<OrderMode>("limit");
  const [limitPrice, setLimitPrice] = useState("");
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (open) {
      setOrderMode("limit");
      setLimitPrice("");
      setPlacing(false);
    }
  }, [open]);

  const label = isSell ? "Sell More" : "Buy More";

  const canConfirm =
    qty > 0 && (orderMode === "market" || (!!limitPrice && parseFloat(limitPrice) > 0));

  async function handleConfirm() {
    setPlacing(true);
    try {
      const txn = isSell ? "Sell" : "Buy";
      await placeOrder(
        position.instrumentToken,
        qty,
        txn,
        position.product,
        orderMode,
        orderMode === "limit" ? parseFloat(limitPrice) : undefined,
        position.broker ?? "upstox",
        position.exchange,
      );
      toast.success(`${label} order placed`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPlacing(false);
    }
  }
  const Icon  = isSell ? TrendingDown : TrendingUp;
  const color = isSell ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn("size-4", isSell ? "text-red-400" : "text-green-400")} />
            {label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <SymbolChip position={position} />

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quantity</Label>
            <QuickTradeQtyInput
              value={qtyValue}
              mode={qtyMode}
              lotSize={lotSize}
              onChange={setQtyValue}
              onToggleMode={toggleQtyMode}
            />
          </div>

          <OrderModeToggle value={orderMode} onChange={setOrderMode} />

          {orderMode === "limit" && (
            <LimitPriceInput value={limitPrice} onChange={setLimitPrice} />
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={placing} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canConfirm || placing}
            onClick={handleConfirm}
            className={cn("text-white", color)}
          >
            <Icon className="size-3.5" />
            {placing ? "Placing…" : label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Convert Position Dialog ───────────────────────────────────────────────────

interface ConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: Position;
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

        <div className="space-y-4">
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

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quantity</Label>
            <QuickTradeQtyInput
              value={qtyValue}
              mode={qtyMode}
              lotSize={lotSize}
              onChange={setQtyValue}
              onToggleMode={toggleQtyMode}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={qty === 0 || converting} onClick={handleConfirm}>
            <RefreshCw className={cn("size-3.5", converting && "animate-spin")} />
            {converting ? "Converting…" : `Convert to ${toLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
