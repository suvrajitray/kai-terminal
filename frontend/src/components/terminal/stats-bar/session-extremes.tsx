import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PnlBadge } from "./pnl-badge";

interface SessionExtremesProps {
  maxProfit: number | null;
  maxLoss: number | null;
}

export function SessionExtremes({ maxProfit, maxLoss }: SessionExtremesProps) {
  if (maxProfit === null && maxLoss === null) return null;

  return (
    <>
      <div className="h-4 w-px bg-border" />
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center gap-3 text-xs cursor-default">
            {maxProfit !== null && (
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground">↑</span>
                <PnlBadge value={maxProfit} />
              </span>
            )}
            {maxLoss !== null && maxLoss !== maxProfit && (
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground">↓</span>
                <PnlBadge value={maxLoss} />
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Session peak / trough MTM</p>
        </TooltipContent>
      </Tooltip>
    </>
  );
}

