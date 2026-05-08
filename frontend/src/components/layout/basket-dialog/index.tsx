// frontend/src/components/layout/basket-dialog/index.tsx
import { useState, useCallback, useMemo, useEffect } from "react";
import { ShoppingCart, CircleX, Trash2, ArrowRightLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useBasketStore } from "@/stores/basket-store";
import { useBrokerStore } from "@/stores/broker-store";
import { BROKERS } from "@/lib/constants";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { useDirectMarginEstimate } from "@/components/layout/use-margin-estimate";
import { useAvailableMargin } from "@/components/panels/use-order-dialog-state";
import { getMarginColor } from "@/components/panels/order-dialog-parts/order-dialog-utils";
import { placeOrder, type MarginInstrument } from "@/services/trading-api";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { toast } from "@/lib/toast";
import { BasketItemRow } from "./basket-item-row";
import { StrategyStrip } from "./strategy-strip";
import type { SupportedBroker } from "@/components/panels/order-dialog-parts/types";

interface BasketDialogProps {
  open: boolean;
  onClose: () => void;
}

export function BasketDialog({ open, onClose }: BasketDialogProps) {
  const items = useBasketStore((s) => s.items);
  const removeItem = useBasketStore((s) => s.removeItem);
  const updateItem = useBasketStore((s) => s.updateItem);
  const clearBasket = useBasketStore((s) => s.clearBasket);

  const credentials = useBrokerStore((s) => s.credentials);
  const activeBrokers = BROKERS.filter(
    (b) => (b.id === "upstox" || b.id === "zerodha") && !isBrokerTokenExpired(b.id, credentials[b.id]?.accessToken),
  );

  const [broker, setBroker] = useState<SupportedBroker | undefined>(activeBrokers[0]?.id as SupportedBroker);

  // Sync default broker if credentials change while dialog is open
  useEffect(() => {
    if (!broker || !activeBrokers.some((b) => b.id === broker)) {
      setBroker(activeBrokers[0]?.id as SupportedBroker | undefined);
    }
  }, [credentials]); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));
  const someSelected = items.some((i) => selectedIds.has(i.id));
  const selectedCount = useMemo(() => items.filter((i) => selectedIds.has(i.id)).length, [items, selectedIds]);

  const activeBroker = (broker ?? "upstox") as "upstox" | "zerodha";

  const marginInstruments = useMemo<MarginInstrument[] | null>(() => {
    if (items.length === 0) return null;
    return items.map((item) => ({
      instrumentToken: item.instrumentKey,
      quantity: item.qty * item.lotSize,
      product: item.product,
      transactionType: item.transactionType,
    }));
  }, [items]);

  const { margin, loading: marginLoading } = useDirectMarginEstimate(marginInstruments, activeBroker);
  const availableMargin = useAvailableMargin(activeBroker, open);
  const marginColor = getMarginColor({ margin, availableMargin });

  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);
  const [placing, setPlacing] = useState(false);
  const [showStrip, setShowStrip] = useState(false);

  async function handlePlace() {
    const toPlace = someSelected ? items.filter((i) => selectedIds.has(i.id)) : items;
    if (toPlace.length === 0) return;

    setPlacing(true);

    const results = await Promise.allSettled(
      toPlace.map((item) => {
        if (item.orderType === "Limit") {
          const price = parseFloat(item.limitPrice);
          if (isNaN(price) || price <= 0) {
            return Promise.reject(new Error(`${item.displayName}: invalid limit price`));
          }
        }

        let token = item.instrumentKey;
        if (activeBroker === "zerodha") {
          const lookup = getByInstrumentKey(item.instrumentKey);
          if (lookup?.contract.zerodhaToken) token = lookup.contract.zerodhaToken;
        }

        const qty = item.qty * item.lotSize;
        const orderType = item.orderType === "Limit" ? "limit" : "market";
        const limitPrice = item.orderType === "Limit" ? parseFloat(item.limitPrice) : undefined;

        return placeOrder(token, qty, item.transactionType, item.product, orderType, limitPrice, activeBroker, item.exchange);
      }),
    );

    setPlacing(false);
    setSelectedIds(new Set());

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failedNames = results
      .map((r, i) => (r.status === "rejected" ? toPlace[i].displayName : null))
      .filter(Boolean) as string[];

    if (failedNames.length === 0) {
      toast.success(`${successCount} order${successCount !== 1 ? "s" : ""} placed`);
    } else if (successCount > 0) {
      toast.warning(`${successCount} placed · ${failedNames.length} failed: ${failedNames.join(", ")}`);
    } else {
      toast.error(`Orders failed: ${failedNames.join(", ")}`);
    }
  }

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  }, [allSelected, items]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const removeSelected = useCallback(() => {
    selectedIds.forEach((id) => removeItem(id));
    setSelectedIds(new Set());
  }, [selectedIds, removeItem]);

  const handleClearBasket = useCallback(() => {
    clearBasket();
    setSelectedIds(new Set());
  }, [clearBasket]);

  const brokerLabel = broker === "zerodha" ? "Zerodha" : "Upstox";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[960px] p-0 gap-0 overflow-hidden" showCloseButton={false}>
        <DialogTitle className="sr-only">Basket</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Basket</span>
            <span className="text-xs text-muted-foreground">
              {items.length} / 20 items
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowStrip((s) => !s)}
              className={cn(
                "flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold transition-colors",
                showStrip
                  ? "border-emerald-700/50 bg-emerald-950/40 text-emerald-400"
                  : "border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              Strategies
            </button>
            {items.length > 0 && (
              <button
                onClick={handleClearBasket}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <CircleX className="size-3.5" />
                Clear basket
              </button>
            )}
          </div>
        </div>

        {/* Strategy strip */}
        {showStrip && <StrategyStrip />}

        {/* Table */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <ShoppingCart className="size-8 opacity-20" />
            <p className="text-sm">Basket is empty</p>
            <p className="text-xs opacity-60">Add instruments from the option chain or positions panel</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="pl-3 py-2 w-7">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-2 py-2 w-8"></th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Instrument
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    LTP
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Order type
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Product
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Qty
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Price
                  </th>
                  <th className="w-10 px-3 border-l border-border/30"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <BasketItemRow
                    key={item.id}
                    item={item}
                    selected={selectedIds.has(item.id)}
                    onToggleSelect={() => toggleSelect(item.id)}
                    onUpdate={(patch) => updateItem(item.id, patch)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border/40 bg-muted/10">
          {/* Left: remove selected / broker routing */}
          <div className="flex items-center gap-4">
            {someSelected && (
              <button
                onClick={removeSelected}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="size-3.5" />
                Remove {selectedCount} selected
              </button>
            )}
            {activeBrokers.length > 1 ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ArrowRightLeft className="size-3.5" />
                  <span>Route via</span>
                </div>
                <div className="flex items-center gap-1 rounded-md border border-border/40 bg-background p-0.5">
                  {activeBrokers.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setBroker(b.id as SupportedBroker)}
                      className={cn(
                        "cursor-pointer rounded px-3 py-1 text-xs font-semibold transition-all",
                        broker === b.id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {b.id === "upstox" ? "Upstox" : "Zerodha"}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/60">via {brokerLabel}</span>
            )}

            {/* Margin info */}
            {items.length > 0 && (
              <>
                <div className="h-6 w-px bg-border/40" />
                <div className="space-y-0.5">
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
              </>
            )}
          </div>

          {/* Right: close + place */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={placing}
              className="px-4 py-1.5 rounded border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Close
            </button>
            <button
              onClick={handlePlace}
              disabled={items.length === 0 || placing}
              className="px-5 py-1.5 rounded bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
            >
              {placing
                ? "Placing…"
                : someSelected
                  ? `Place ${selectedCount}`
                  : "Place all"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
