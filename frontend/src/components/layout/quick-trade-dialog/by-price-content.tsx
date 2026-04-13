import React, { useState, type ReactNode } from "react";
import { toast } from "@/lib/toast";
import { Zap, TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QtyInput, type QtyMode } from "@/components/ui/qty-input";
import { UNDERLYING_KEYS } from "@/lib/shift-config";
import { placeOrderByPrice } from "@/services/trading-api";

type Direction = "Buy" | "Sell";
type ActionType = "CE" | "PE" | "BOTH";

export interface ByPriceContentProps {
  broker: "upstox" | "zerodha";
  underlying: string;
  expiry: string;
  product: "I" | "D";
  quantity: number;
  qtyValue: string;
  qtyMode: QtyMode;
  lotSize: number;
  onQtyChange: (v: string) => void;
  onToggleQtyMode: () => void;
  sharedControls: ReactNode;
}

export const ByPriceContent = React.memo(function ByPriceContent({
  broker, underlying, expiry, product, quantity,
  qtyValue, qtyMode, lotSize, onQtyChange, onToggleQtyMode,
  sharedControls,
}: ByPriceContentProps) {
  const [price, setPrice]   = useState("");
  const [direction, setDir] = useState<Direction>("Sell");
  const [acting, setActing] = useState<ActionType | null>(null);

  const isBuy  = direction === "Buy";
  const accent = isBuy
    ? { toggle: "bg-green-600" }
    : { toggle: "bg-red-600"   };

  async function execute(action: ActionType) {
    const targetPremium = parseFloat(price);
    if (!targetPremium || targetPremium <= 0) { toast.error("Enter a valid target premium"); return; }
    if (!expiry) { toast.error("Select an expiry"); return; }

    const underlyingKey = UNDERLYING_KEYS[underlying];
    setActing(action);
    try {
      const base = { underlyingKey, expiry, targetPremium, qty: quantity, transactionType: direction, product };
      const orders: Promise<void>[] = [];
      if (action === "CE" || action === "BOTH") orders.push(placeOrderByPrice(broker, { ...base, instrumentType: "CE" }));
      if (action === "PE" || action === "BOTH") orders.push(placeOrderByPrice(broker, { ...base, instrumentType: "PE" }));

      await Promise.all(orders);
      toast.success("Order placed successfully");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-5">
      {sharedControls}

      {/* Quantity + Target Premium + Direction toggle */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Quantity</p>
          <QtyInput
            value={qtyValue}
            mode={qtyMode}
            lotSize={lotSize}
            onChange={onQtyChange}
            onToggleMode={onToggleQtyMode}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Target Premium</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="pl-7 h-9 text-sm"
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Direction</p>
          <div className="flex h-9 items-center">
            <button
              onClick={() => setDir((d) => d === "Buy" ? "Sell" : "Buy")}
              className={cn(
                "relative flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors duration-200",
                accent.toggle,
              )}
              title={`Switch to ${isBuy ? "Sell" : "Buy"}`}
            >
              <span className={cn(
                "absolute size-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                isBuy ? "translate-x-5" : "translate-x-0.5",
              )} />
            </button>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-2">
        {(["CE", "PE", "BOTH"] as ActionType[]).map((action) => {
          const Icon =
            action === "BOTH" ? ArrowUpDown
            : action === "CE" ? (isBuy ? TrendingUp : TrendingDown)
            : (isBuy ? TrendingDown : TrendingUp);
          return (
            <Button
              key={action}
              disabled={acting !== null || !qtyValue || !price || parseFloat(price) <= 0}
              onClick={() => execute(action)}
              className={cn(
                "h-11 font-semibold text-sm transition-all gap-1.5",
                isBuy ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white",
              )}
            >
              {acting === action ? (
                <><Zap className="size-3.5 animate-pulse" />Placing…</>
              ) : (
                <><Icon className="size-4" />{action === "BOTH" ? "CE + PE" : action}</>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
});
