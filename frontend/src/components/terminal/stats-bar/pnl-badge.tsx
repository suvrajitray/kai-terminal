// frontend/src/components/terminal/stats-bar/pnl-badge.tsx
import { memo } from "react";
import { cn } from "@/lib/utils";

interface PnlBadgeProps {
  value: number;
  prefix?: string;
}

export const PnlBadge = memo(function PnlBadge({ value, prefix = "" }: PnlBadgeProps) {
  return (
    <span className={cn("font-mono tabular-nums font-medium", value >= 0 ? "text-emerald-500" : "text-rose-500")}>
      {prefix}{value >= 0 ? "+" : "-"}₹{Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
    </span>
  );
});
