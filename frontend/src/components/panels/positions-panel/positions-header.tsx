import { RefreshCw, LogOut, AlertCircle, ChevronDown, ChevronUp, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PnlCell } from "./position-row";
import type { Position } from "@/types";

interface PositionsHeaderProps {
  positions: Position[];
  openCount: number;
  totalPnl: number;
  isLive: boolean;
  loading: boolean;
  error: string | null;
  acting: string | null;
  expanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
  onExitAll: () => void;
}

export function PositionsHeader({
  positions,
  openCount,
  totalPnl,
  isLive,
  loading,
  error,
  acting,
  expanded,
  onToggle,
  onRefresh,
  onExitAll,
}: PositionsHeaderProps) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-3 border-b border-border bg-muted/40 px-3">
      <span className="text-xs font-semibold tracking-tight">Positions</span>

      {positions.length > 0 && (
        <>
          <span className="text-xs text-muted-foreground">
            {openCount} open · {positions.length - openCount} closed
          </span>
          <span className="text-xs">
            MTM: <PnlCell value={totalPnl} />
          </span>
        </>
      )}

      <div className="ml-auto flex items-center gap-1">
        {error && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3" />
            {error}
          </span>
        )}
        {openCount > 0 && (
          <Button
            size="sm"
            variant="destructive"
            className="h-6 px-2 text-xs"
            onClick={onExitAll}
            disabled={acting === "all"}
          >
            <LogOut className="mr-1 size-3" />
            Exit All
          </Button>
        )}
        <span
          title={isLive ? "Live" : "Polling"}
          className={cn("flex items-center", isLive ? "text-green-500" : "text-muted-foreground")}
        >
          {isLive ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          onClick={onToggle}
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
}
