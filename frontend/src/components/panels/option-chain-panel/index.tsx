import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UNDERLYING_KEYS } from "@/lib/shift-config";
import { useOptionChain } from "./use-option-chain";
import { OptionChainTable } from "./option-chain-table";

interface Props {
  onClose?: () => void;
}

export function OptionChainPanel({ onClose }: Props) {
  const {
    underlying, setUnderlying,
    expiry, setExpiry,
    expiries,
    visibleRows,
    extraRows,
    liveStrikeSet,
    atmStrike,
    spotPrice,
    pcr,
    showExtra, setShowExtra,
    loading,
    refresh,
  } = useOptionChain();

  const underlyings = Object.keys(UNDERLYING_KEYS);
  const hasExtra = extraRows.length > 0 && !showExtra;

  return (
    <div className="flex w-[380px] shrink-0 flex-col overflow-hidden border-l border-border bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-muted/30 px-2 py-1.5">
        {/* Underlying selector */}
        <select
          value={underlying}
          onChange={(e) => setUnderlying(e.target.value)}
          className="h-6 rounded border border-border/60 bg-background px-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {underlyings.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        {/* Expiry selector */}
        <select
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className="h-6 flex-1 rounded border border-border/60 bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {expiries.map((exp) => (
            <option key={exp} value={exp}>{exp}</option>
          ))}
          {expiries.length === 0 && <option value="">—</option>}
        </select>

        {/* Refresh */}
        <Button
          size="icon"
          variant="ghost"
          className="size-6 shrink-0"
          onClick={refresh}
          disabled={loading}
          title="Refresh chain"
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} />
        </Button>

        {/* Close */}
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

      {/* Spot / ATM / PCR sub-header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border/40 bg-muted/10 px-3 py-1 text-[11px]">
        <span className="flex items-center gap-1">
          <span className="text-muted-foreground">Spot</span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {spotPrice > 0 ? spotPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
          </span>
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="flex items-center gap-1">
          <span className="text-muted-foreground">ATM</span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {atmStrike > 0 ? atmStrike.toLocaleString("en-IN") : "—"}
          </span>
        </span>
        {pcr !== null && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground">PCR</span>
              <span className={cn(
                "font-mono font-medium tabular-nums",
                pcr >= 1 ? "text-green-400" : "text-red-400",
              )}>
                {pcr.toFixed(2)}
              </span>
            </span>
          </>
        )}
      </div>

      {/* Chain table — scrollable */}
      <div className="flex-1 overflow-y-auto">
        {loading && visibleRows.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
            Loading…
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
            No data
          </div>
        ) : (
          <OptionChainTable
            rows={visibleRows}
            atmStrike={atmStrike}
            liveStrikeSet={liveStrikeSet}
          />
        )}

        {/* Load more / static notice */}
        {!loading && visibleRows.length > 0 && (
          <div className="border-t border-border/30 px-3 py-2">
            {hasExtra ? (
              <button
                onClick={() => setShowExtra(true)}
                className="w-full rounded border border-border/40 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
              >
                Load {Math.min(extraRows.length, 40)} more strikes
              </button>
            ) : showExtra ? (
              <p className="text-center text-[10px] text-muted-foreground/50">
                Load-more prices are static — click ↻ to refresh all
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
