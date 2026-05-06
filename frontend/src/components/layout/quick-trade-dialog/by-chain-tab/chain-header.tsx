import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StrategyMode } from "./types";

interface ChainHeaderProps {
  mode: StrategyMode;
  loading: boolean;
  spotPrice: number;
  atmStrike: number | null;
  onModeChange: (mode: StrategyMode) => void;
  onRefresh: () => void;
}

const STRATEGY_MODES: StrategyMode[] = ["strangle", "straddle"];

export function ChainHeader({ mode, loading, spotPrice, atmStrike, onModeChange, onRefresh }: ChainHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-muted/20 p-1">
        {STRATEGY_MODES.map((strategyMode) => (
          <button
            key={strategyMode}
            onClick={() => onModeChange(strategyMode)}
            className={cn(
              "rounded-md px-4 py-1.5 text-xs font-semibold transition-all capitalize",
              mode === strategyMode
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {strategyMode}
          </button>
        ))}
      </div>

      <div className="flex flex-1 items-center justify-end gap-3 text-[11px]">
        {spotPrice > 0 && (
          <span className="text-muted-foreground">
            Spot <span className="font-semibold text-foreground tabular-nums">{spotPrice.toFixed(2)}</span>
          </span>
        )}
        {atmStrike != null && (
          <>
            <span className="text-border/50">·</span>
            <span className="text-muted-foreground">
              ATM <span className="font-bold text-amber-400 tabular-nums">{atmStrike}</span>
            </span>
          </>
        )}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} />
        </button>
      </div>
    </div>
  );
}

