import { useMemo } from "react";
import { BarChart2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePayoffData, payoffAt } from "./use-payoff-data";
import type { RenderedCurve } from "./use-payoff-data";
import { PayoffChart } from "./payoff-chart";
import type { Position } from "@/types";

const GROUP_COLORS = ["#38bdf8", "#fbbf24", "#a78bfa", "#34d399"];
const STEPS = 300;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positions: Position[];
}

export function PayoffChartDialog({ open, onOpenChange, positions }: Props) {
  const { groups, indexName, spot } = usePayoffData(positions, open);

  const allLegs = useMemo(() => groups.flatMap((g) => g.legs), [groups]);

  const { renderedCurves, xMin, xMax, yMin, yMax } = useMemo(() => {
    const empty = {
      renderedCurves: [] as RenderedCurve[],
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
      xMin, xMax,
      yMin: Math.min(0, globalMin) - yPad,
      yMax: Math.max(0, globalMax) + yPad,
    };
  }, [allLegs, spot, groups]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[580px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <BarChart2 className="size-4" />
            P&amp;L at Expiry
            {indexName && (
              <span className="text-muted-foreground font-normal">— {indexName}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <PayoffChart
          groups={groups}
          spot={spot}
          renderedCurves={renderedCurves}
          xMin={xMin}
          xMax={xMax}
          yMin={yMin}
          yMax={yMax}
        />
      </DialogContent>
    </Dialog>
  );
}
