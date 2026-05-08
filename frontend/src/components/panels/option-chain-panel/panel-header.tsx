import { RefreshCw, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PanelHeaderProps {
  underlying: string;
  underlyings: string[];
  expiry: string;
  expiries: string[];
  loading: boolean;
  onUnderlyingChange: (underlying: string) => void;
  onExpiryChange: (expiry: string) => void;
  onRefresh: () => void;
  onClose?: () => void;
  basketMode: boolean;
  onBasketModeToggle: () => void;
}

export function PanelHeader({
  underlying,
  underlyings,
  expiry,
  expiries,
  loading,
  onUnderlyingChange,
  onExpiryChange,
  onRefresh,
  onClose,
  basketMode,
  onBasketModeToggle,
}: PanelHeaderProps) {
  return (
    <div className="flex flex-col 2xl:flex-row shrink-0 border-b border-border bg-muted/40">
      <div className="flex h-9 items-center gap-1.5 flex-1 px-2">
        <select
          value={underlying}
          onChange={(event) => onUnderlyingChange(event.target.value)}
          className="h-6 rounded border border-border/60 bg-background px-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {underlyings.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <select
          value={expiry}
          onChange={(event) => onExpiryChange(event.target.value)}
          className="h-6 w-28 rounded border border-border/60 bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {expiries.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
          {expiries.length === 0 && <option value="">—</option>}
        </select>
      </div>

      <div className="flex h-9 items-center gap-1.5 shrink-0 px-2 2xl:ml-auto border-t border-border/40 2xl:border-t-0">
        <Button
          size="icon"
          variant="ghost"
          className="size-6 shrink-0"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh chain"
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} />
        </Button>
        <Button
          size="icon"
          variant={basketMode ? "default" : "ghost"}
          className={cn("size-6 shrink-0", basketMode && "bg-primary text-primary-foreground hover:bg-primary/90")}
          onClick={onBasketModeToggle}
          title={basketMode ? "Exit basket mode" : "Add to basket mode"}
        >
          <ShoppingCart className="size-3" />
        </Button>
        {onClose && (
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0"
            onClick={onClose}
            title="Close option chain"
          >
            <X className="size-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

