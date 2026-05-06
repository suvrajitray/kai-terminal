import { RefreshCw, XCircle, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Order } from "@/types";

export type Tab = "open" | "executed" | "risk-log";

interface OrdersPanelHeaderProps {
  expanded: boolean;
  tab: Tab;
  openOrders: Order[];
  executedOrders: Order[];
  loading: boolean;
  error: string | null;
  cancelling: string | null;
  riskLogEntryCount: number;
  lastSeenRiskCount: number;
  onToggle: () => void;
  onTabChange: (tab: Tab) => void;
  onLoad: () => void;
  onCancelAll: () => void;
  onMarkRiskSeen: () => void;
}

export function OrdersPanelHeader({
  expanded, tab, openOrders, executedOrders, loading, error, cancelling,
  riskLogEntryCount, lastSeenRiskCount, onToggle, onTabChange, onLoad, onCancelAll, onMarkRiskSeen,
}: OrdersPanelHeaderProps) {
  const hasUnreadRisk = tab !== "risk-log" && riskLogEntryCount > lastSeenRiskCount;

  return (
    <div
      className={cn("flex h-8 shrink-0 items-center gap-1 border-b border-border bg-muted/40 px-3", !expanded && "cursor-pointer")}
      onClick={!expanded ? onToggle : undefined}
    >
      <button
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium transition-colors",
          tab === "open" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        )}
        onClick={(e) => { if (expanded) e.stopPropagation(); onTabChange("open"); if (!expanded) onToggle(); }}
      >
        Open
        {openOrders.length > 0 && (
          <Badge variant="secondary" className="h-4 px-1 text-[10px]">{openOrders.length}</Badge>
        )}
      </button>

      <button
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium transition-colors",
          tab === "executed" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        )}
        onClick={(e) => { if (expanded) e.stopPropagation(); onTabChange("executed"); if (!expanded) onToggle(); }}
      >
        Executed
        {executedOrders.length > 0 && (
          <Badge variant="secondary" className="h-4 px-1 text-[10px]">{executedOrders.length}</Badge>
        )}
      </button>

      <button
        className={cn(
          "flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors",
          tab === "risk-log" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        )}
        onClick={(e) => {
          if (expanded) e.stopPropagation();
          onTabChange("risk-log");
          onMarkRiskSeen();
          if (!expanded) onToggle();
        }}
      >
        Events
        {hasUnreadRisk && <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />}
      </button>

      <div className="ml-auto flex items-center gap-1">
        {error && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3" />
            {error}
          </span>
        )}
        {expanded && tab === "open" && openOrders.length > 0 && (
          <Button
            size="sm"
            variant="destructive"
            className="h-6 px-2 text-xs"
            onClick={onCancelAll}
            disabled={cancelling === "all"}
          >
            <XCircle className="mr-1 size-3" />
            Cancel All
          </Button>
        )}
        {expanded && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="size-6" onClick={onLoad} disabled={loading}>
                <RefreshCw className={cn("size-3", loading && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Refresh</p></TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8" onClick={onToggle}>
              {expanded ? <ChevronDown className="size-5" /> : <ChevronUp className="size-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>{expanded ? "Collapse" : "Expand"}</p></TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
