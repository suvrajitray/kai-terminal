import { cn } from "@/lib/utils";
import type { RenderedCurve } from "./use-payoff-data";

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function fmt(v: number): string {
  return (v >= 0 ? "+" : "−") + "₹" + INR.format(Math.abs(v));
}

function pct(price: number, spot: number): string {
  const p = ((price - spot) / spot) * 100;
  return (p >= 0 ? "+" : "") + p.toFixed(1) + "%";
}

function isEdgeRising(pts: [number, number][]): boolean {
  const n = pts.length;
  if (n < 5) return false;
  const rightRising = pts[n - 1][1] > pts[n - 2][1] && pts[n - 2][1] > pts[n - 3][1];
  const leftRising  = pts[0][1] > pts[1][1] && pts[1][1] > pts[2][1];
  return rightRising || leftRising;
}

function isEdgeFalling(pts: [number, number][]): boolean {
  const n = pts.length;
  if (n < 5) return false;
  const rightFalling = pts[n - 1][1] < pts[n - 2][1] && pts[n - 2][1] < pts[n - 3][1];
  const leftFalling  = pts[0][1] < pts[1][1] && pts[1][1] < pts[2][1];
  return rightFalling || leftFalling;
}

interface StatsBarProps {
  renderedCurves: RenderedCurve[];
  combinedPts: [number, number][];
  spot: number;
  atSpot: number;
}

export function StatsBar({ renderedCurves, combinedPts, spot, atSpot }: StatsBarProps) {
  if (renderedCurves.length === 0 || combinedPts.length === 0) return null;

  const combinedPayoffs = combinedPts.map((p) => p[1]);
  const rawMax = Math.max(...combinedPayoffs);
  const rawMin = Math.min(...combinedPayoffs);

  const unlimitedProfit = isEdgeRising(combinedPts);
  const unlimitedLoss   = isEdgeFalling(combinedPts);

  // Collect all breakevens across all groups, deduplicated
  const allBEs = renderedCurves
    .flatMap((c) => c.breakevens)
    .filter((be, i, arr) => arr.findIndex((b) => Math.abs(b - be) < 1) === i)
    .sort((a, b) => a - b);

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      {/* Stat boxes */}
      <div className="grid grid-cols-3 divide-x divide-border/40">
        <div className="px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Max Profit</div>
          <div className={cn("text-sm font-bold font-mono tabular-nums",
            unlimitedProfit ? "text-muted-foreground" : "text-emerald-500")}>
            {unlimitedProfit ? "Unlimited" : fmt(rawMax)}
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Max Loss</div>
          <div className={cn("text-sm font-bold font-mono tabular-nums",
            unlimitedLoss ? "text-muted-foreground" : "text-rose-500")}>
            {unlimitedLoss ? "Unlimited" : fmt(rawMin)}
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">At Spot</div>
          <div className={cn("text-sm font-bold font-mono tabular-nums",
            atSpot >= 0 ? "text-emerald-500" : "text-rose-500")}>
            {fmt(atSpot)}
          </div>
        </div>
      </div>

      {/* Breakeven row */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-t border-border/40 bg-muted/10">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">B/E</span>
        {allBEs.length > 0
          ? allBEs.map((be, i) => (
              <span key={i} className="flex items-center gap-1 bg-muted/30 border border-border/40 rounded px-2 py-0.5">
                <span className="text-xs font-mono font-semibold tabular-nums">₹{INR.format(be)}</span>
                <span className="text-[10px] text-muted-foreground">{pct(be, spot)}</span>
              </span>
            ))
          : (
              <span className="text-[11px] text-muted-foreground">
                {atSpot >= 0 ? "profitable at all prices" : "net loss at all prices"}
              </span>
            )
        }
      </div>
    </div>
  );
}
