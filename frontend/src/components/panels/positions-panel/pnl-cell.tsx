import { cn } from "@/lib/utils";

export const INR     = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const INR_INT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function PnlCell({ value, pct, noDecimal }: { value: number; pct?: number; noDecimal?: boolean }) {
  const color = value > 0 ? "text-emerald-500" : value < 0 ? "text-rose-500" : "text-muted-foreground";
  const fmt = noDecimal ? INR_INT : INR;
  return (
    <div className="flex flex-col items-end gap-0">
      <span className={cn("font-mono tabular-nums", color)}>
        {value >= 0 ? "+" : ""}₹{fmt.format(value)}
      </span>
      {pct !== undefined && (
        <span className={cn("font-mono text-[10px] tabular-nums opacity-60", color)}>
          {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
