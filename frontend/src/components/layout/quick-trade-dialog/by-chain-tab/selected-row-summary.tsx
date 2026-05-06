import { formatPrice } from "./chain-rows";
import type { ChainRow, StrategyMode } from "./types";

interface SelectedRowSummaryProps {
  selected: ChainRow | null;
  mode: StrategyMode;
}

export function SelectedRowSummary({ selected, mode }: SelectedRowSummaryProps) {
  if (!selected) {
    return (
      <div className="flex h-9 items-center justify-center rounded-lg border border-dashed border-border/40 text-xs text-muted-foreground/50">
        Click a row to select a strike
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
      <span className="text-muted-foreground capitalize">{mode}</span>
      {mode === "straddle" ? (
        <span className="font-bold tabular-nums">{selected.ceStrike}</span>
      ) : (
        <>
          <span className="text-sky-600 dark:text-sky-400 font-bold tabular-nums">CE {selected.ceStrike}</span>
          <span className="text-border/50">+</span>
          <span className="text-red-600 dark:text-red-400 font-bold tabular-nums">PE {selected.peStrike}</span>
        </>
      )}
      <span className="text-border/50 mx-0.5">·</span>
      <span className="text-sky-600 dark:text-sky-400 tabular-nums">{formatPrice(selected.ceLtp)}</span>
      <span className="text-muted-foreground/50">+</span>
      <span className="text-red-600 dark:text-red-400 tabular-nums">{formatPrice(selected.peLtp)}</span>
      {selected.ceLtp != null && selected.peLtp != null && (
        <>
          <span className="text-border/50 mx-0.5">·</span>
          <span className="text-muted-foreground tabular-nums">
            Combined {(selected.ceLtp + selected.peLtp).toFixed(2)}
          </span>
        </>
      )}
    </div>
  );
}

