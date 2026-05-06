import { formatExpiryLabel } from "@/stores/option-contracts-store";
import { cn } from "@/lib/utils";
import type { OrderIntent } from "@/components/panels/order-dialog";
import type { OrderAccent, OrderDirection } from "./types";

interface OrderDialogHeaderProps {
  intent: OrderIntent;
  expiry?: string;
  ltp: number;
  direction: OrderDirection;
  accent: OrderAccent;
  hideDirectionToggle?: boolean;
  onDirectionChange: (direction: OrderDirection) => void;
}

export function OrderDialogHeader({
  intent,
  expiry,
  ltp,
  direction,
  accent,
  hideDirectionToggle,
  onDirectionChange,
}: OrderDialogHeaderProps) {
  const isBuy = direction === "Buy";

  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-base font-semibold text-foreground">
          {intent.underlying} {intent.strike} {intent.side}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          NFO{expiry ? ` / ${formatExpiryLabel(expiry)}` : ""} / LTP{" "}
          <span className="font-mono font-semibold text-foreground tabular-nums">{ltp.toFixed(2)}</span>
        </p>
      </div>
      {!hideDirectionToggle && (
        <button
          onClick={() => onDirectionChange(isBuy ? "Sell" : "Buy")}
          className={cn(
            "relative mt-0.5 flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
            accent.toggle,
          )}
          title={`Switch to ${isBuy ? "Sell" : "Buy"}`}
        >
          <span
            className={cn(
              "absolute size-5 rounded-full bg-white shadow-sm transition-transform duration-200",
              isBuy ? "translate-x-5" : "translate-x-0.5",
            )}
          />
        </button>
      )}
    </div>
  );
}

