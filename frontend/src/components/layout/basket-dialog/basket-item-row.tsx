// frontend/src/components/layout/basket-dialog/basket-item-row.tsx
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { formatExpiryLabel } from "@/stores/option-contracts-store";
import type { BasketItem } from "@/stores/basket-store";

interface BasketItemRowProps {
  item: BasketItem;
  onUpdate: (patch: Partial<BasketItem>) => void;
  onRemove: () => void;
}

export function BasketItemRow({ item, onUpdate, onRemove }: BasketItemRowProps) {
  const isSell = item.transactionType === "Sell";
  const isLimit = item.orderType === "Limit";

  return (
    <tr className="border-b border-border/30 hover:bg-muted/20 [&>td]:align-middle">
      {/* Checkbox — placeholder for future batch-selection */}
      <td className="pl-3 py-2 w-7">
        <Checkbox disabled />
      </td>

      {/* B/S toggle */}
      <td className="px-2 py-2 w-8">
        <button
          onClick={() => onUpdate({ transactionType: isSell ? "Buy" : "Sell" })}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold transition-colors",
            isSell
              ? "bg-red-900/50 text-red-300 hover:bg-red-900/70"
              : "bg-green-900/50 text-green-300 hover:bg-green-900/70",
          )}
        >
          {isSell ? "S" : "B"}
        </button>
      </td>

      {/* Instrument */}
      <td className="px-3 py-2">
        <div className="text-sm font-medium">{item.displayName}</div>
        <div className="text-[11px] text-muted-foreground">
          {item.exchange} · {item.expiry ? formatExpiryLabel(item.expiry) : "—"}
        </div>
      </td>

      {/* LTP */}
      <td className="px-3 py-2 text-right font-mono text-sm tabular-nums text-muted-foreground">
        {item.ltp.toFixed(2)}
      </td>

      {/* Market / Limit pill */}
      <td className="px-3 py-2">
        <div className="flex overflow-hidden rounded border border-border/50 w-fit">
          <button
            onClick={() => onUpdate({ orderType: "Market", limitPrice: "" })}
            className={cn(
              "px-2 py-1 text-[10px] font-medium transition-colors",
              !isLimit
                ? "bg-blue-900/50 text-blue-300"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            Market
          </button>
          <button
            onClick={() => onUpdate({ orderType: "Limit", limitPrice: String(item.ltp.toFixed(2)) })}
            className={cn(
              "px-2 py-1 text-[10px] font-medium transition-colors border-l border-border/50",
              isLimit
                ? "bg-violet-900/50 text-violet-300"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            Limit
          </button>
        </div>
      </td>

      {/* Intraday / Delivery pill */}
      <td className="px-3 py-2">
        <div className="flex overflow-hidden rounded border border-border/50 w-fit">
          <button
            onClick={() => onUpdate({ product: "Intraday" })}
            className={cn(
              "px-2 py-1 text-[10px] font-medium transition-colors",
              item.product === "Intraday"
                ? "bg-emerald-900/50 text-emerald-300"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            Intraday
          </button>
          <button
            onClick={() => onUpdate({ product: "Delivery" })}
            className={cn(
              "px-2 py-1 text-[10px] font-medium transition-colors border-l border-border/50",
              item.product === "Delivery"
                ? "bg-amber-900/50 text-amber-300"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            Delivery
          </button>
        </div>
      </td>

      {/* Qty (lots) */}
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          min="1"
          value={item.qty}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            onUpdate({ qty: isNaN(v) || v < 1 ? 1 : v });
          }}
          className="w-12 rounded border border-border/50 bg-muted/20 px-2 py-1 text-right text-sm tabular-nums font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </td>

      {/* Price */}
      <td className="px-3 py-2 text-right">
        {isLimit ? (
          <input
            type="number"
            step="0.05"
            min="0"
            value={item.limitPrice}
            onChange={(e) => onUpdate({ limitPrice: e.target.value })}
            className="w-16 rounded border border-border/50 bg-muted/20 px-2 py-1 text-right text-sm tabular-nums font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        ) : (
          <span className="text-sm tabular-nums font-mono text-muted-foreground/40">—</span>
        )}
      </td>

      {/* Remove */}
      <td className="pr-3 py-2 w-8">
        <button
          onClick={onRemove}
          className="flex items-center justify-center p-1 text-muted-foreground/40 hover:text-destructive transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </td>
    </tr>
  );
}
