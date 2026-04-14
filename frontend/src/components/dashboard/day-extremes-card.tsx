import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSessionExtremes } from "@/components/terminal/stats-bar/use-session-extremes";
import type { Position } from "@/types";

const INR = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 });

interface DayExtremesCardProps {
  positions: Position[];
}

export function DayExtremesCard({ positions }: DayExtremesCardProps) {
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const { maxProfit, maxLoss } = useSessionExtremes(totalPnl, positions.length > 0);

  const formatVal = (v: number) =>
    `${v >= 0 ? "+" : "-"}₹${INR.format(Math.abs(v))}`;

  return (
    <Card className="border-border/40 bg-muted/10">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Day Extremes
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 text-sm text-muted-foreground cursor-default">
                <TrendingUp className="size-3.5 text-emerald-400" />
                Peak Profit
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Highest MTM value reached during the session</p>
            </TooltipContent>
          </Tooltip>
          {maxProfit !== null ? (
            <span className={cn("tabular-nums font-semibold text-sm", maxProfit >= 0 ? "text-emerald-500" : "text-rose-500")}>
              {formatVal(maxProfit)}
            </span>
          ) : (
            <span className="text-muted-foreground/40 text-sm">—</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 text-sm text-muted-foreground cursor-default">
                <TrendingDown className="size-3.5 text-rose-400" />
                Peak Loss
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Lowest MTM value reached during the session</p>
            </TooltipContent>
          </Tooltip>
          {maxLoss !== null ? (
            <span className={cn("tabular-nums font-semibold text-sm", maxLoss >= 0 ? "text-emerald-500" : "text-rose-500")}>
              {formatVal(maxLoss)}
            </span>
          ) : (
            <span className="text-muted-foreground/40 text-sm">—</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
