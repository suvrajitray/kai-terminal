# Payoff Chart — Stats Bar + Payoff Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Stats Bar (Max Profit/Loss, At Spot, breakevens with %) and a Payoff Table tab to the P&L at Expiry dialog.

**Architecture:** Lift the curve computation from `PayoffChart` up to `index.tsx` so both the new `StatsBar` and existing `PayoffChart` share one computation. Add a "Chart | Table" tab switcher in `index.tsx`; the Table tab renders a new `PayoffTable` component. No backend changes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, shadcn/ui, custom SVG chart

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/components/terminal/payoff-chart-dialog/use-payoff-data.ts` | Modify | Add `RenderedCurve` type export |
| `frontend/src/components/terminal/payoff-chart-dialog/index.tsx` | Modify | Lift curve computation; add tab state; render `StatsBar` + tabs + conditional content |
| `frontend/src/components/terminal/payoff-chart-dialog/payoff-chart.tsx` | Modify | Accept pre-computed `renderedCurves` + bounds as props; remove internal `useMemo` |
| `frontend/src/components/terminal/payoff-chart-dialog/stats-bar.tsx` | Create | Max Profit, Max Loss, At Spot, Breakeven row |
| `frontend/src/components/terminal/payoff-chart-dialog/payoff-table.tsx` | Create | Price-ladder table with per-expiry P&L columns |

---

## Task 1: Add `RenderedCurve` type + lift curve computation to `index.tsx`

This is a pure refactor — chart behaviour must be identical after this task.

**Files:**
- Modify: `frontend/src/components/terminal/payoff-chart-dialog/use-payoff-data.ts`
- Modify: `frontend/src/components/terminal/payoff-chart-dialog/index.tsx`
- Modify: `frontend/src/components/terminal/payoff-chart-dialog/payoff-chart.tsx`

- [ ] **Step 1.1 — Add `RenderedCurve` type to `use-payoff-data.ts`**

  Append after the `ExpiryGroup` interface (line 16):

  ```ts
  export interface RenderedCurve {
    expiry: string;
    color: string;
    pts: [number, number][];
    breakevens: number[];
    linePath: string;
    profitPts: string;
    lossPts: string;
  }
  ```

- [ ] **Step 1.2 — Rewrite `index.tsx` to own the curve computation**

  Replace the entire file:

  ```tsx
  import { useState, useMemo } from "react";
  import { BarChart2 } from "lucide-react";
  import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import { usePayoffData, payoffAt } from "./use-payoff-data";
  import type { RenderedCurve } from "./use-payoff-data";
  import { PayoffChart } from "./payoff-chart";
  import { cn } from "@/lib/utils";
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
    const [activeTab, setActiveTab] = useState<"chart" | "table">("chart");

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

      // Combined (all-legs) curve for stats
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

        const toXRaw = (s: number) => ((s - xMin) / (xMax - xMin)) * STEPS;
        const linePath = pts
          .map(([s, v], i) => `${i === 0 ? "M" : "L"}${toXRaw(s).toFixed(1)},${v.toFixed(1)}`)
          .join(" ");
        const profitPts = pts.map(([s, v]) => `${toXRaw(s).toFixed(1)},${Math.max(v, 0).toFixed(1)}`).join(" ");
        const lossPts   = pts.map(([s, v]) => `${toXRaw(s).toFixed(1)},${Math.min(v, 0).toFixed(1)}`).join(" ");

        return { expiry: g.expiry, color, pts, breakevens, linePath, profitPts, lossPts };
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

    if (!open) return null;

    const hasData = renderedCurves.length > 0;

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

          {/* Tab bar */}
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
  ```

  > Note: `StatsBar` and `PayoffTable` imports are added in later tasks. For now this compiles without them.

- [ ] **Step 1.3 — Rewrite `payoff-chart.tsx` to accept pre-computed curves**

  Replace the entire file:

  ```tsx
  import { memo } from "react";
  import { cn } from "@/lib/utils";
  import { payoffAt } from "./use-payoff-data";
  import type { ExpiryGroup, RenderedCurve } from "./use-payoff-data";

  const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

  const W = 500, H = 240;
  const PAD = { top: 28, right: 20, bottom: 40, left: 68 };
  const DW = W - PAD.left - PAD.right;
  const DH = H - PAD.top - PAD.bottom;

  function fmtY(v: number): string {
    const abs = Math.abs(v);
    if (abs >= 1_00_000) return `${(v / 1_00_000).toFixed(1)}L`;
    if (abs >= 1_000)    return `${(v / 1_000).toFixed(0)}k`;
    return String(Math.round(v));
  }

  interface PayoffChartProps {
    groups: ExpiryGroup[];
    spot: number;
    renderedCurves: RenderedCurve[];
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  }

  export const PayoffChart = memo(function PayoffChart({
    groups, spot, renderedCurves, xMin, xMax, yMin, yMax,
  }: PayoffChartProps) {
    if (renderedCurves.length === 0) {
      return (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No open option positions
        </div>
      );
    }

    const xR = xMax - xMin;
    const yR = yMax - yMin;

    const toX = (s: number) => PAD.left + ((s - xMin) / xR) * DW;
    const toY = (v: number) => PAD.top  + ((yMax - v) / yR) * DH;

    const zeroY  = toY(0);
    const spotX  = spot > 0 ? toX(spot) : -999;
    const inside = (x: number) => x >= PAD.left && x <= PAD.left + DW;

    // Remap the pre-computed raw (step-space) paths to SVG pixel paths
    const STEPS = renderedCurves[0]?.pts.length - 1 ?? 300;
    const svgCurves = renderedCurves.map((gc) => {
      const linePath = gc.pts
        .map(([s, v], i) => `${i === 0 ? "M" : "L"}${toX(s).toFixed(1)},${toY(v).toFixed(1)}`)
        .join(" ");
      const profitPts = gc.pts
        .map(([s, v]) => `${toX(s).toFixed(1)},${toY(Math.max(v, 0)).toFixed(1)}`)
        .join(" ");
      const lossPts = gc.pts
        .map(([s, v]) => `${toX(s).toFixed(1)},${toY(Math.min(v, 0)).toFixed(1)}`)
        .join(" ");
      return { ...gc, linePath, profitPts, lossPts };
    });

    const yTicks = [-1, -0.5, 0, 0.5, 1]
      .map((t) => yMin + (t + 1) / 2 * yR)
      .filter((v) => v >= yMin && v <= yMax);

    const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => xMin + t * xR);

    return (
      <div className="space-y-4">
        {/* Per-expiry summary rows */}
        {svgCurves.map((gc, gi) => {
          const pnlAtSpot = spot > 0 ? payoffAt(groups[gi].legs, spot) : null;
          return (
            <div key={gc.expiry} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="inline-block h-2 w-5 rounded-full" style={{ background: gc.color }} />
                <span className="font-medium">{gc.expiry}</span>
              </span>
              {pnlAtSpot !== null && (
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground">at spot</span>
                  <span className={cn("font-mono font-semibold tabular-nums", pnlAtSpot >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {pnlAtSpot >= 0 ? "+" : ""}₹{INR.format(pnlAtSpot)}
                  </span>
                </span>
              )}
              {gc.breakevens.length > 0
                ? gc.breakevens.map((be, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="text-muted-foreground">B/E{gc.breakevens.length > 1 ? ` ${i + 1}` : ""}</span>
                      <span className="font-mono font-semibold tabular-nums">₹{INR.format(be)}</span>
                    </span>
                  ))
                : (
                    <span className="text-muted-foreground text-[11px]">
                      {pnlAtSpot != null && pnlAtSpot < 0 ? "net loss at all prices" : "profitable at all prices"}
                    </span>
                  )
              }
            </div>
          );
        })}

        {/* SVG chart */}
        <div className="rounded-lg border border-border/40 bg-[hsl(var(--background))] overflow-hidden">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ aspectRatio: `${W}/${H}` }}>
            {/* Horizontal grid + y-axis labels */}
            {yTicks.map((v, i) => {
              const y   = toY(v);
              const isZ = Math.abs(v) < yR * 0.005;
              return (
                <g key={i}>
                  <line
                    x1={PAD.left} y1={y} x2={PAD.left + DW} y2={y}
                    stroke="hsl(var(--border))"
                    strokeWidth={isZ ? 1 : 0.5}
                    strokeDasharray={isZ ? "none" : "3 3"}
                    opacity={isZ ? 1 : 0.6}
                  />
                  <text
                    x={PAD.left - 6} y={y + 3.5}
                    textAnchor="end" fontSize={9}
                    fill={v > 0 ? "#4ade80" : v < 0 ? "#f87171" : "hsl(var(--muted-foreground))"}
                  >
                    {fmtY(v)}
                  </text>
                </g>
              );
            })}

            {/* Per-expiry fills and lines */}
            {svgCurves.map((gc) => (
              <g key={gc.expiry}>
                <polygon
                  points={`${PAD.left},${zeroY} ${gc.profitPts} ${PAD.left + DW},${zeroY}`}
                  fill="rgb(74 222 128 / 0.08)"
                />
                <polygon
                  points={`${PAD.left},${zeroY} ${gc.lossPts} ${PAD.left + DW},${zeroY}`}
                  fill="rgb(248 113 113 / 0.08)"
                />
                <path
                  d={gc.linePath}
                  fill="none"
                  stroke={gc.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {gc.breakevens.filter((be) => inside(toX(be))).map((be, i) => (
                  <g key={i}>
                    <line
                      x1={toX(be)} y1={PAD.top} x2={toX(be)} y2={PAD.top + DH}
                      stroke={gc.color} strokeWidth={0.8} strokeDasharray="4 3" opacity={0.6}
                    />
                    <text x={toX(be)} y={PAD.top - 8} textAnchor="middle" fontSize={8} fill={gc.color} opacity={0.8}>
                      ₹{INR.format(be)}
                    </text>
                  </g>
                ))}
              </g>
            ))}

            {/* Spot line + dots */}
            {inside(spotX) && (
              <g>
                <line
                  x1={spotX} y1={PAD.top} x2={spotX} y2={PAD.top + DH}
                  stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="5 3"
                />
                {svgCurves.map((gc, gi) => {
                  const pnl = spot > 0 ? payoffAt(groups[gi].legs, spot) : null;
                  return pnl !== null ? (
                    <circle
                      key={gc.expiry}
                      cx={spotX} cy={toY(pnl)}
                      r={4}
                      fill={pnl >= 0 ? "#4ade80" : "#f87171"}
                      stroke="hsl(var(--background))"
                      strokeWidth={1.5}
                    />
                  ) : null;
                })}
                <text x={spotX} y={PAD.top + DH + 28} textAnchor="middle" fontSize={8.5} fill="#fbbf24">
                  ₹{INR.format(spot)}
                </text>
              </g>
            )}

            {/* X-axis labels */}
            {xTicks.filter((v) => Math.abs(v - spot) > xR * 0.06).map((v, i) => (
              <text
                key={i}
                x={toX(v)} y={PAD.top + DH + 14}
                textAnchor="middle" fontSize={8.5}
                fill="hsl(var(--muted-foreground))"
              >
                ₹{INR.format(v)}
              </text>
            ))}

            {/* Chart border */}
            <rect
              x={PAD.left} y={PAD.top} width={DW} height={DH}
              fill="none" stroke="hsl(var(--border))" strokeWidth={0.5}
            />
          </svg>
        </div>

        {/* Legs grouped by expiry */}
        <div className="rounded-lg border border-border/40 divide-y divide-border/40">
          {svgCurves.map((gc, gi) => (
            <div key={gc.expiry}>
              <div className="flex items-center gap-2 px-3 py-1 bg-muted/20">
                <span className="inline-block h-2 w-4 rounded-full shrink-0" style={{ background: gc.color }} />
                <span className="text-[11px] font-medium text-muted-foreground">{gc.expiry}</span>
              </div>
              {groups[gi].legs.map((leg, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs pl-7">
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">{leg.index}</span>
                    <span className="font-mono font-medium">₹{INR.format(leg.strike)}</span>
                    <span className={cn("rounded px-1 py-0.5 text-[10px] font-bold",
                      leg.instrumentType === "CE" ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400")}>
                      {leg.instrumentType}
                    </span>
                    <span className={cn("text-[11px] font-medium", leg.quantity < 0 ? "text-rose-400" : "text-emerald-400")}>
                      {leg.quantity < 0 ? "Short" : "Long"} {Math.abs(leg.quantity)}
                    </span>
                  </span>
                  <span className="font-mono text-muted-foreground">avg ₹{leg.avgPrice.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  });
  ```

- [ ] **Step 1.4 — Verify: Open the payoff chart dialog**

  ```bash
  cd frontend && npm run dev
  ```

  Open the terminal page, click "P&L at Expiry". Confirm:
  - Chart still renders correctly
  - Breakeven lines still appear
  - Spot indicator still shows
  - No TypeScript errors in console

- [ ] **Step 1.5 — Commit**

  ```bash
  git add frontend/src/components/terminal/payoff-chart-dialog/use-payoff-data.ts \
          frontend/src/components/terminal/payoff-chart-dialog/index.tsx \
          frontend/src/components/terminal/payoff-chart-dialog/payoff-chart.tsx
  git commit -m "refactor: lift payoff curve computation to dialog index"
  ```

---

## Task 2: Create `stats-bar.tsx`

**Files:**
- Create: `frontend/src/components/terminal/payoff-chart-dialog/stats-bar.tsx`
- Modify: `frontend/src/components/terminal/payoff-chart-dialog/index.tsx`

- [ ] **Step 2.1 — Create `stats-bar.tsx`**

  ```tsx
  import { cn } from "@/lib/utils";
  import type { RenderedCurve } from "./use-payoff-data";

  const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

  function fmt(v: number): string {
    return (v >= 0 ? "+" : "") + "₹" + INR.format(Math.abs(v));
  }

  function pct(price: number, spot: number): string {
    const p = ((price - spot) / spot) * 100;
    return (p >= 0 ? "+" : "") + p.toFixed(1) + "%";
  }

  function isEdgeRising(pts: [number, number][]): boolean {
    if (pts.length < 2) return false;
    return (
      pts[pts.length - 1][1] > pts[pts.length - 2][1] ||
      pts[0][1] > pts[1][1]
    );
  }

  function isEdgeFalling(pts: [number, number][]): boolean {
    if (pts.length < 2) return false;
    return (
      pts[pts.length - 1][1] < pts[pts.length - 2][1] ||
      pts[0][1] < pts[1][1]
    );
  }

  interface StatsBarProps {
    renderedCurves: RenderedCurve[];
    combinedPts: [number, number][];
    spot: number;
  }

  export function StatsBar({ renderedCurves, combinedPts, spot }: StatsBarProps) {
    if (renderedCurves.length === 0 || combinedPts.length === 0) return null;

    const combinedPayoffs = combinedPts.map((p) => p[1]);
    const rawMax = Math.max(...combinedPayoffs);
    const rawMin = Math.min(...combinedPayoffs);
    const atSpot = combinedPts.reduce((best, [x, y]) =>
      Math.abs(x - spot) < Math.abs(best[0] - spot) ? [x, y] : best
    )[1];

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
  ```

- [ ] **Step 2.2 — Add `StatsBar` to `index.tsx`**

  Add the import after the existing imports in `index.tsx`:

  ```tsx
  import { StatsBar } from "./stats-bar";
  ```

  Add `<StatsBar>` inside `<DialogContent>`, between the `<DialogHeader>` and the tab bar div:

  ```tsx
  {hasData && (
    <StatsBar
      renderedCurves={renderedCurves}
      combinedPts={combinedPts}
      spot={spot}
    />
  )}
  ```

  The full `<DialogContent>` children block should now read:

  ```tsx
  <DialogHeader>
    <DialogTitle className="flex items-center gap-2 text-sm">
      <BarChart2 className="size-4" />
      P&amp;L at Expiry
      {indexName && (
        <span className="text-muted-foreground font-normal">— {indexName}</span>
      )}
    </DialogTitle>
  </DialogHeader>

  {hasData && (
    <StatsBar
      renderedCurves={renderedCurves}
      combinedPts={combinedPts}
      spot={spot}
    />
  )}

  {/* Tab bar */}
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

  <PayoffChart
    groups={groups}
    spot={spot}
    renderedCurves={renderedCurves}
    xMin={xMin}
    xMax={xMax}
    yMin={yMin}
    yMax={yMax}
  />
  ```

- [ ] **Step 2.3 — Verify stats bar**

  Open the payoff dialog. Confirm:
  - Three stat boxes appear above the tabs
  - Max Profit shows green `+₹X,XXX` (or "Unlimited" for naked longs)
  - Max Loss shows red `−₹X,XXX` (or "Unlimited" for naked shorts)
  - At Spot matches the per-expiry "at spot" figure shown in the chart summary rows (for single-expiry positions)
  - Breakeven chips appear with `₹XX,XXX +X.X%` format matching spot prices on the chart

- [ ] **Step 2.4 — Commit**

  ```bash
  git add frontend/src/components/terminal/payoff-chart-dialog/stats-bar.tsx \
          frontend/src/components/terminal/payoff-chart-dialog/index.tsx
  git commit -m "feat: add stats bar to payoff chart dialog"
  ```

---

## Task 3: Create `payoff-table.tsx`

**Files:**
- Create: `frontend/src/components/terminal/payoff-chart-dialog/payoff-table.tsx`
- Modify: `frontend/src/components/terminal/payoff-chart-dialog/index.tsx`

- [ ] **Step 3.1 — Create `payoff-table.tsx`**

  ```tsx
  import { useEffect, useRef } from "react";
  import { cn } from "@/lib/utils";
  import { payoffAt } from "./use-payoff-data";
  import type { ExpiryGroup } from "./use-payoff-data";

  const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

  function fmt(v: number): string {
    return (v >= 0 ? "+" : "") + "₹" + INR.format(Math.abs(v));
  }

  function pct(price: number, spot: number): string {
    const p = ((price - spot) / spot) * 100;
    return (p >= 0 ? "+" : "") + p.toFixed(1) + "%";
  }

  /** Pick nearest round step from [25,50,100,250,500] to target. Ties: smaller wins. */
  function nearestRoundInterval(target: number): number {
    const candidates = [25, 50, 100, 250, 500];
    return candidates.reduce((best, c) =>
      Math.abs(c - target) < Math.abs(best - target) ? c : best
    );
  }

  interface PayoffTableProps {
    groups: ExpiryGroup[];
    spot: number;
    groupColors: string[];
  }

  export function PayoffTable({ groups, spot, groupColors }: PayoffTableProps) {
    const spotRowRef = useRef<HTMLTableRowElement>(null);

    useEffect(() => {
      spotRowRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
    }, [spot]);

    if (groups.length === 0 || spot === 0) {
      return (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No open option positions
        </div>
      );
    }

    const interval = nearestRoundInterval(spot * 0.005);
    const anchor = Math.floor(spot / interval) * interval;

    // 10 rows below anchor, spot row, 10 rows above anchor
    const steps = Array.from({ length: 21 }, (_, i) => anchor + (i - 10) * interval);

    return (
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <div className="max-h-[300px] overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b border-border/40">
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Price
                </th>
                {groups.map((g, i) => (
                  <th key={g.expiry} className="text-right px-3 py-2 text-[10px] uppercase tracking-wide font-semibold">
                    <span className="flex items-center justify-end gap-1">
                      <span
                        className="inline-block h-1.5 w-3 rounded-full"
                        style={{ background: groupColors[i] ?? "#94a3b8" }}
                      />
                      <span className="text-muted-foreground">{g.expiry}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Spot row (live) */}
              <tr ref={spotRowRef} className="bg-blue-950/40 border-y border-blue-900/40">
                <td className="px-3 py-1.5 font-mono">
                  <span className="text-blue-400 font-semibold tabular-nums">₹{INR.format(spot)}</span>
                  <span className="text-[10px] text-muted-foreground ml-1.5">now</span>
                </td>
                {groups.map((g) => {
                  const pnl = payoffAt(g.legs, spot);
                  return (
                    <td key={g.expiry} className={cn(
                      "px-3 py-1.5 text-right font-mono font-semibold tabular-nums",
                      pnl >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {fmt(pnl)}
                    </td>
                  );
                })}
              </tr>

              {steps.map((price) => {
                const isAbove = price > spot;
                return (
                  <tr key={price} className="border-t border-border/20 hover:bg-muted/10 transition-colors">
                    <td className="px-3 py-1.5 font-mono">
                      <span className="tabular-nums text-foreground">₹{INR.format(price)}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">{pct(price, spot)}</span>
                    </td>
                    {groups.map((g) => {
                      const pnl = payoffAt(g.legs, price);
                      return (
                        <td key={g.expiry} className={cn(
                          "px-3 py-1.5 text-right font-mono tabular-nums",
                          pnl >= 0 ? "text-emerald-500" : "text-rose-500"
                        )}>
                          {fmt(pnl)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3.2 — Wire `PayoffTable` into `index.tsx`**

  Add import:

  ```tsx
  import { PayoffTable } from "./payoff-table";
  ```

  Replace the `<PayoffChart ... />` at the bottom of `<DialogContent>` with:

  ```tsx
  {activeTab === "chart" ? (
    <PayoffChart
      groups={groups}
      spot={spot}
      renderedCurves={renderedCurves}
      xMin={xMin}
      xMax={xMax}
      yMin={yMin}
      yMax={yMax}
    />
  ) : (
    <PayoffTable
      groups={groups}
      spot={spot}
      groupColors={renderedCurves.map((c) => c.color)}
    />
  )}
  ```

- [ ] **Step 3.3 — Verify the table tab**

  Open the payoff dialog and click "Table". Confirm:
  - Table renders with 21 rows (10 below, spot row, 10 above)
  - Spot row is highlighted blue and has "now" label
  - Spot row auto-scrolls into view
  - Column headers show expiry with colored dot (matching chart curve colors)
  - Profit values are green, loss values red
  - Price column shows `₹XX,XXX +X.X%` format
  - Switching back to "Chart" tab restores the SVG chart

  Also verify interval logic:
  - NIFTY (~24,000): rows step by ₹100
  - BANKNIFTY (~52,000): rows step by ₹250
  - SENSEX (~75,000): rows step by ₹250

- [ ] **Step 3.4 — Commit**

  ```bash
  git add frontend/src/components/terminal/payoff-chart-dialog/payoff-table.tsx \
          frontend/src/components/terminal/payoff-chart-dialog/index.tsx
  git commit -m "feat: add payoff table tab to P&L dialog"
  ```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Stats Bar (Max Profit, Max Loss, At Spot, BE row with %) → Task 2 ✓
  - "Unlimited" detection for profit/loss → Task 2, `stats-bar.tsx` ✓
  - Tab switcher Chart | Table → Task 1 `index.tsx` + Task 3 ✓
  - Per-expiry columns in table → Task 3 `payoff-table.tsx` ✓
  - Spot row highlighted, scrolled into view → Task 3 ✓
  - `nearestRoundInterval` using [25,50,100,250,500] candidates → Task 3 ✓
  - Curve computation lifted to `index.tsx` → Task 1 ✓
  - `RenderedCurve` type exported from `use-payoff-data.ts` → Task 1 ✓

- [x] **No placeholders** — all steps contain complete code

- [x] **Type consistency:**
  - `RenderedCurve` defined in Task 1.1, imported in `payoff-chart.tsx` (Task 1.3), `stats-bar.tsx` (Task 2.1), and `index.tsx` (Task 1.2) ✓
  - `combinedPts: [number, number][]` defined in `index.tsx` useMemo, passed to `StatsBar` ✓
  - `groupColors: string[]` passed as `renderedCurves.map(c => c.color)` — matches `PayoffTableProps` ✓
  - `PayoffChart` props (`renderedCurves`, `xMin`, `xMax`, `yMin`, `yMax`) match updated interface ✓
