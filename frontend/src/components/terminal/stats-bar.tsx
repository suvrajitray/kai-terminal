import { RefreshCw, LogOut, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PnlCell } from "@/components/panels/positions-panel/position-row";
import type { Position } from "@/types";

interface StatsBarProps {
  positions: Position[];
  isLive: boolean;
  loading: boolean;
  error: string | null;
  acting: string | null;
  onRefresh: () => void;
  onExitAll: () => void;
}

export function StatsBar({
  positions,
  isLive,
  loading,
  error,
  acting,
  onRefresh,
  onExitAll,
}: StatsBarProps) {
  const openCount = positions.filter((p) => p.quantity !== 0).length;
  const closedCount = positions.filter((p) => p.quantity === 0).length;
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);

  return (
    <div className="flex h-9 shrink-0 items-center gap-4 border-b border-border bg-muted/40 px-3">
      <span
        title={isLive ? "Live" : "Offline"}
        className={cn("flex items-center gap-1 text-xs font-medium", isLive ? "text-green-500" : "text-muted-foreground")}
      >
        {isLive ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
        {isLive ? "Live" : "Offline"}
      </span>

      {positions.length > 0 && (
        <>
          <span className="text-sm font-semibold">
            MTM <PnlCell value={totalPnl} />
          </span>
          <span className="text-xs text-muted-foreground">
            {openCount} open · {closedCount} closed
          </span>
        </>
      )}

      {error && (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3" />
          {error}
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
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
      </div>
    </div>
  );
}
