import { memo } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PositionStatsProps {
  allSelected: boolean;
  someSelected: boolean;
  toggleSelectAll: () => void;
  selectedCount: number;
  acting: string | null;
  onExitSelected: () => void;
  onExitByType: (type: "CE" | "PE") => () => void;
  showGreeks: boolean;
  netDelta: number | undefined;
  thetaPerDay: number;
  thetaEarnedToday: number;
}

export const PositionStats = memo(function PositionStats({
  allSelected,
  someSelected,
  toggleSelectAll,
  selectedCount,
  acting,
  onExitSelected,
  onExitByType,
  showGreeks,
  netDelta,
  thetaPerDay,
  thetaEarnedToday,
}: PositionStatsProps) {
  return (
    <tr className="border-b border-border text-muted-foreground h-9">
      <th className="pl-3 py-1.5 w-7">
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={toggleSelectAll}
        />
      </th>
      <th className="px-3 py-1.5 text-left font-medium">Symbol</th>
      <th className="px-3 py-1.5 text-left font-medium">Product</th>
      <th className="px-3 py-1.5 text-right font-medium">Qty</th>
      <th className="px-3 py-1.5 text-right font-medium">Avg</th>
      <th className="px-3 py-1.5 text-right font-medium">LTP</th>
      <th className="px-3 py-1.5 text-right font-medium">P&amp;L</th>
      <th className="px-3 py-1.5">
        <div className="flex items-center justify-end gap-2">
          {/* Portfolio Greeks */}
          {showGreeks && (
            <span className="flex items-center gap-2.5 text-[10px] font-normal">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex cursor-default items-center gap-0.5">
                    <span className="text-muted-foreground">Δ</span>
                    <span className={cn(
                      "font-mono tabular-nums font-medium",
                      Math.abs(netDelta!) <= 0.1 ? "text-emerald-500" :
                      Math.abs(netDelta!) <= 0.5 ? "text-amber-500" : "text-rose-500",
                    )}>
                      {netDelta! >= 0 ? "+" : ""}{netDelta!.toFixed(2)}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px] space-y-1 text-xs">
                  <p className="font-semibold">Net Delta (Δ)</p>
                  <p className="text-muted-foreground">
                    How much your portfolio moves per ₹1 rise in the underlying. <span className="text-foreground">+{netDelta!.toFixed(1)}</span> means you gain ₹{netDelta!.toFixed(1)} for every ₹1 rise.
                  </p>
                  <p className={cn("font-medium",
                    Math.abs(netDelta!) <= 0.1 ? "text-emerald-400" :
                    Math.abs(netDelta!) <= 0.5 ? "text-amber-400" : "text-rose-400"
                  )}>
                    {Math.abs(netDelta!) <= 0.1
                      ? "Balanced — ideal for sellers."
                      : Math.abs(netDelta!) <= 0.5
                      ? "Slight directional bias — watch it."
                      : netDelta! > 0
                      ? "Bullish skew — consider selling CEs or buying PEs to hedge."
                      : "Bearish skew — consider selling PEs or buying CEs to hedge."}
                  </p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex cursor-default items-center gap-0.5">
                    <span className="text-muted-foreground">Θ</span>
                    <span className={cn("font-mono tabular-nums font-medium", thetaPerDay > 0 ? "text-emerald-500" : "text-rose-500")}>
                      {thetaEarnedToday !== 0
                        ? <>{thetaEarnedToday > 0 ? "+" : ""}₹{Math.round(thetaEarnedToday)} <span className="text-muted-foreground/50 font-normal">/ ₹{Math.round(thetaPerDay)}</span></>
                        : <>{thetaPerDay >= 0 ? "+" : ""}₹{Math.round(thetaPerDay)}/d</>
                      }
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px] space-y-1 text-xs">
                  <p className="font-semibold">Net Theta (Θ) — Time Decay</p>
                  <p className="text-muted-foreground">
                    Premium your portfolio earns (or loses) per day from time decay alone.
                    {thetaEarnedToday !== 0 && <> Today so far: <span className="text-foreground">₹{Math.round(thetaEarnedToday)}</span> out of a ₹{Math.round(thetaPerDay)}/day total.</>}
                  </p>
                  <p className={cn("font-medium", thetaPerDay > 0 ? "text-emerald-400" : "text-rose-400")}>
                    {thetaPerDay > 0
                      ? "Positive theta — time works in your favour (short options)."
                      : "Negative theta — you're paying decay (long options)."}
                  </p>
                </TooltipContent>
              </Tooltip>

            </span>
          )}

          {showGreeks && <span className="text-muted-foreground/30">|</span>}

          {/* Actions */}
          {selectedCount > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{selectedCount} selected</span>
              <Button
                size="sm"
                variant="destructive"
                className="h-5 px-2 text-[10px]"
                disabled={acting === "selected"}
                onClick={onExitSelected}
              >
                <LogOut className="mr-1 size-2.5" />
                {acting === "selected" ? "Exiting…" : `Exit ${selectedCount}`}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-2 text-[10px] text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
                disabled={!!acting}
                onClick={onExitByType("CE")}
              >
                Exit CEs
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-2 text-[10px] text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
                disabled={!!acting}
                onClick={onExitByType("PE")}
              >
                Exit PEs
              </Button>
            </div>
          )}
        </div>
      </th>
    </tr>
  );
});
