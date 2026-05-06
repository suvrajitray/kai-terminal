import { forwardRef } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "./chain-rows";
import type { ChainRow, StrategyMode } from "./types";

interface ChainTableProps {
  rows: ChainRow[];
  loading: boolean;
  expiry: string;
  mode: StrategyMode;
  selectedDiff: number | null;
  scrollTargetDiff: number;
  onSelectedDiffChange: (diff: number | null) => void;
  onTargetRow: (element: HTMLTableRowElement | null) => void;
}

export const ChainTable = forwardRef<HTMLDivElement, ChainTableProps>(function ChainTable({
  rows,
  loading,
  expiry,
  mode,
  selectedDiff,
  scrollTargetDiff,
  onSelectedDiffChange,
  onTargetRow,
}, scrollRef) {
  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      <table className="w-full text-[10px]">
        <thead className="bg-muted/20 border-b border-border/30">
          <tr>
            <HeaderCell className="pl-3 w-14 text-left text-muted-foreground/60">Diff</HeaderCell>
            <HeaderCell className="w-20 text-center text-sky-600/80 dark:text-sky-400/80">Call</HeaderCell>
            <HeaderCell className="w-20 text-center text-sky-600/60 dark:text-sky-400/60">LTP</HeaderCell>
            <HeaderCell className="w-20 text-center text-red-600/80 dark:text-red-400/80">Put</HeaderCell>
            <HeaderCell className="w-20 text-center text-red-600/60 dark:text-red-400/60">LTP</HeaderCell>
            <HeaderCell className="pr-3 w-20 text-right text-muted-foreground/60">Combined</HeaderCell>
          </tr>
        </thead>
      </table>

      <div ref={scrollRef} className="max-h-[min(280px,35dvh)] overflow-y-auto">
        {loading ? (
          <div className="flex h-44 items-center justify-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="size-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
            {expiry ? "No data" : "Select an expiry"}
          </div>
        ) : (
          <table className="w-full">
            <tbody>
              {rows.map((row) => (
                <ChainTableRow
                  key={`${row.ceStrike}-${row.peStrike}`}
                  row={row}
                  selected={row.diff === selectedDiff}
                  atmHighlighted={row.diff === scrollTargetDiff && mode === "straddle"}
                  target={row.diff === scrollTargetDiff}
                  onTargetRow={onTargetRow}
                  onClick={() => onSelectedDiffChange(row.diff === selectedDiff ? null : row.diff)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
});

function HeaderCell({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <th className={cn("py-2 font-semibold uppercase tracking-wider", className)}>
      {children}
    </th>
  );
}

function ChainTableRow({
  row,
  selected,
  atmHighlighted,
  target,
  onTargetRow,
  onClick,
}: {
  row: ChainRow;
  selected: boolean;
  atmHighlighted: boolean;
  target: boolean;
  onTargetRow: (element: HTMLTableRowElement | null) => void;
  onClick: () => void;
}) {
  const combined = row.ceLtp != null && row.peLtp != null ? (row.ceLtp + row.peLtp).toFixed(2) : "—";

  return (
    <tr
      ref={target ? onTargetRow : undefined}
      onClick={onClick}
      className={cn(
        "cursor-pointer border-b border-border/10 last:border-0 transition-colors",
        selected ? "bg-primary/15 hover:bg-primary/20" : atmHighlighted ? "bg-amber-500/10 hover:bg-amber-500/15" : "hover:bg-muted/20",
      )}
    >
      <td className="py-2.5 pl-3 w-14">
        <span
          className={cn(
            "text-[11px] tabular-nums font-semibold",
            row.diff === 0 ? "text-amber-600 dark:text-amber-400" : selected ? "text-primary" : "text-muted-foreground/70",
          )}
        >
          {row.diff === 0 ? (
            <span className="flex items-center gap-1">
              <span className="inline-block size-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
              0
            </span>
          ) : (
            row.diff > 0 ? `+${row.diff}` : row.diff
          )}
        </span>
      </td>

      <StrikeCell value={row.ceStrike} className={row.diff === 0 ? "text-amber-600 dark:text-amber-400" : "text-sky-600/90 dark:text-sky-400/90"} />
      <td className="py-2.5 w-20 text-center tabular-nums font-mono text-[12px] text-sky-600 dark:text-sky-300">
        {formatPrice(row.ceLtp)}
      </td>
      <StrikeCell value={row.peStrike} className={row.diff === 0 ? "text-amber-600 dark:text-amber-400" : "text-red-600/90 dark:text-red-400/90"} />
      <td className="py-2.5 w-20 text-center tabular-nums font-mono text-[12px] text-red-600 dark:text-red-300">
        {formatPrice(row.peLtp)}
      </td>
      <td className="py-2.5 pr-3 w-20 text-right tabular-nums font-mono text-[11px] text-muted-foreground/70">
        {combined}
      </td>
    </tr>
  );
}

function StrikeCell({ value, className }: { value: number; className: string }) {
  return (
    <td className="py-2.5 w-20 text-center">
      <span className={cn("text-xs font-bold tabular-nums", className)}>
        {value}
      </span>
    </td>
  );
}

