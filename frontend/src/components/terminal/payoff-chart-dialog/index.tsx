import { useMemo, useState, useEffect } from "react";
import { BarChart2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePayoffData, payoffAt } from "./use-payoff-data";
import type { RenderedCurve } from "./use-payoff-data";
import { useIndicesFeed } from "@/hooks/use-indices-feed";
import { PayoffChart } from "./payoff-chart";
import { PayoffTable } from "./payoff-table";
import { StatsBar } from "./stats-bar";
import { InstrumentPanel } from "./instrument-panel";
import type { Position } from "@/types";

const GROUP_COLORS = ["#38bdf8", "#fbbf24", "#a78bfa", "#34d399"];
const STEPS = 300;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positions: Position[];
}

export function PayoffChartDialog({ open, onOpenChange, positions }: Props) {
  const { underlyingGroups } = usePayoffData(positions, open);
  const feed = useIndicesFeed();

  // Default selected = first group with open positions
  const [selectedUnderlying, setSelectedUnderlying] = useState<string>("");

  useEffect(() => {
    if (underlyingGroups.length > 0 && !underlyingGroups.find((g) => g.underlying === selectedUnderlying)) {
      setSelectedUnderlying(underlyingGroups[0].underlying);
    }
  }, [underlyingGroups, selectedUnderlying]);

  const selectedGroup = underlyingGroups.find((g) => g.underlying === selectedUnderlying) ?? underlyingGroups[0];

  // Live spot for the selected underlying
  const spot = useMemo(() => {
    if (!selectedGroup?.feedKey) return 0;
    return feed[selectedGroup.feedKey].ltp ?? 0;
  }, [selectedGroup, feed]);

  const groups = selectedGroup?.expiryGroups ?? [];
  const allLegs = useMemo(() => groups.flatMap((g) => g.legs), [groups]);

  const { renderedCurves, combinedPts, xMin, xMax, yMin, yMax } = useMemo(() => {
    const empty = {
      renderedCurves: [] as RenderedCurve[],
      combinedPts: [] as [number, number][],
      xMin: 0, xMax: 0, yMin: -1, yMax: 1,
    };
    if (allLegs.length === 0 || spot === 0) return empty;

    const strikes = allLegs.map((l) => l.strike);
    const minS = Math.min(...strikes);
    const maxS = Math.max(...strikes);
    const buf  = Math.max((maxS - minS) * 0.5, spot * 0.06);
    const xMin = Math.max(0, Math.min(minS, spot) - buf);
    const xMax = Math.max(maxS, spot) + buf;

    const step = (xMax - xMin) / STEPS;
    const xs   = Array.from({ length: STEPS + 1 }, (_, i) => xMin + i * step);
    const combinedPts: [number, number][] = xs.map((x) => [x, payoffAt(allLegs, x)]);

    let globalMin = 0, globalMax = 0;
    const renderedCurves: RenderedCurve[] = groups.map((g, gi) => {
      const color = GROUP_COLORS[gi % GROUP_COLORS.length];
      const pts: [number, number][] = xs.map((s) => [s, payoffAt(g.legs, s)]);
      const payoffs = pts.map((p) => p[1]);
      globalMin = Math.min(globalMin, ...payoffs);
      globalMax = Math.max(globalMax, ...payoffs);

      const breakevens: number[] = [];
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        if ((y0 < 0 && y1 >= 0) || (y0 >= 0 && y1 < 0))
          breakevens.push(x0 + (-y0 / (y1 - y0)) * (x1 - x0));
      }
      return { expiry: g.expiry, color, pts, breakevens };
    });

    const range = Math.max(Math.abs(globalMax - globalMin), 1000);
    const yPad  = range * 0.12;
    return {
      renderedCurves,
      combinedPts,
      xMin, xMax,
      yMin: Math.min(0, globalMin) - yPad,
      yMax: Math.max(0, globalMax) + yPad,
    };
  }, [allLegs, spot, groups]);

  const [activeTab, setActiveTab] = useState<"chart" | "table">("chart");

  if (!open) return null;

  const hasData = renderedCurves.length > 0 && combinedPts.length > 0;
  const atSpot = spot > 0 ? payoffAt(allLegs, spot) : 0;
  const hasGroups = underlyingGroups.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-[1060px] gap-0 overflow-hidden p-0 sm:max-w-[1060px]">
        {/* Left panel — instrument groups */}
        {hasGroups && (
          <div className="flex w-[300px] shrink-0 flex-col border-r border-border/40 overflow-hidden">
            <div className="shrink-0 border-b border-border/40 px-3 py-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instruments</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              <InstrumentPanel
                groups={underlyingGroups}
                selectedUnderlying={selectedUnderlying}
                feed={feed}
                onSelect={setSelectedUnderlying}
              />
            </div>
          </div>
        )}

        {/* Right panel — payoff chart / table */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <DialogHeader className="shrink-0 border-b border-border/40 px-4 py-2.5">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <BarChart2 className="size-4" />
              P&amp;L at Expiry
              {selectedGroup && (
                <span className="text-muted-foreground font-normal">— {selectedGroup.underlying}</span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {hasData && (
              <StatsBar
                renderedCurves={renderedCurves}
                combinedPts={combinedPts}
                spot={spot}
                atSpot={atSpot}
              />
            )}

            {hasData && (
              <div className="flex gap-0 border-b border-border/40 -mb-1">
                {(["chart", "table"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-4 py-2 text-xs font-medium capitalize border-b-2 -mb-px transition-colors",
                      activeTab === tab
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}

            {!hasData && (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                {underlyingGroups.length === 0
                  ? "No open option positions"
                  : "Select an instrument group to view payoff"}
              </div>
            )}

            {hasData && activeTab === "chart" && (
              <PayoffChart
                groups={groups}
                spot={spot}
                renderedCurves={renderedCurves}
                xMin={xMin}
                xMax={xMax}
                yMin={yMin}
                yMax={yMax}
              />
            )}

            {hasData && activeTab === "table" && (
              <PayoffTable
                groups={groups}
                spot={spot}
                groupColors={renderedCurves.map((c) => c.color)}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
