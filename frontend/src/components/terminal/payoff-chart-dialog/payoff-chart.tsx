import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { payoffAt } from "./use-payoff-data";
import type { Leg, ExpiryGroup } from "./use-payoff-data";

// One color per expiry group
const GROUP_COLORS = ["#38bdf8", "#fbbf24", "#a78bfa", "#34d399"];

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

// Chart geometry
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
  indexName: string;
}

export const PayoffChart = memo(function PayoffChart({ groups, spot, indexName: _indexName }: PayoffChartProps) {
  const allLegs = groups.flatMap((g) => g.legs);

  const { xMin, xMax, yMin, yMax, groupCurves } = useMemo(() => {
    if (allLegs.length === 0 || spot === 0)
      return { xMin: 0, xMax: 0, yMin: -1, yMax: 1, groupCurves: [] };

    const strikes = allLegs.map((l) => l.strike);
    const minS = Math.min(...strikes);
    const maxS = Math.max(...strikes);
    const buf  = Math.max((maxS - minS) * 0.5, spot * 0.06);
    const xMin = Math.max(0, Math.min(minS, spot) - buf);
    const xMax = Math.max(maxS, spot) + buf;

    const STEPS = 300;
    const step  = (xMax - xMin) / STEPS;
    const xs    = Array.from({ length: STEPS + 1 }, (_, i) => xMin + i * step);

    let globalMin = 0, globalMax = 0;

    const groupCurves = groups.map((g) => {
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

      return { expiry: g.expiry, pts, breakevens };
    });

    const range = Math.max(Math.abs(globalMax - globalMin), 1000);
    const yPad  = range * 0.12;
    return {
      xMin, xMax,
      yMin: Math.min(0, globalMin) - yPad,
      yMax: Math.max(0, globalMax) + yPad,
      groupCurves,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLegs, spot, groups]);

  const xR = xMax - xMin;
  const yR = yMax - yMin;

  const toX = (s: number) => PAD.left + ((s - xMin) / xR) * DW;
  const toY = (v: number) => PAD.top  + ((yMax - v) / yR) * DH;

  const zeroY  = toY(0);
  const spotX  = spot > 0 ? toX(spot) : -999;
  const inside = (x: number) => x >= PAD.left && x <= PAD.left + DW;

  // Memoize all per-group SVG strings together since they share the same coordinate transform
  const renderedCurves = useMemo(() => groupCurves.map((gc, gi) => {
    const color    = GROUP_COLORS[gi % GROUP_COLORS.length];
    const linePath = gc.pts.map(([s, v], i) => `${i === 0 ? "M" : "L"}${toX(s).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
    const profitPts = gc.pts.map(([s, v]) => `${toX(s).toFixed(1)},${toY(Math.max(v, 0)).toFixed(1)}`).join(" ");
    const lossPts   = gc.pts.map(([s, v]) => `${toX(s).toFixed(1)},${toY(Math.min(v, 0)).toFixed(1)}`).join(" ");
    return { ...gc, color, linePath, profitPts, lossPts };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [groupCurves, xMin, xMax, yMin, yMax]);

  const yTicks = [-1, -0.5, 0, 0.5, 1]
    .map((t) => yMin + (t + 1) / 2 * yR)
    .filter((v) => v >= yMin && v <= yMax);

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => xMin + t * xR);

  const hasData = allLegs.length > 0 && groupCurves.length > 0;

  if (!hasData) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No open option positions
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Per-expiry summary rows */}
      {renderedCurves.map((gc, gi) => {
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
                  x1={PAD.left} y1={y}
                  x2={PAD.left + DW} y2={y}
                  stroke={isZ ? "hsl(var(--border))" : "hsl(var(--border))"}
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
          {renderedCurves.map((gc) => (
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
                    x1={toX(be)} y1={PAD.top}
                    x2={toX(be)} y2={PAD.top + DH}
                    stroke={gc.color} strokeWidth={0.8} strokeDasharray="4 3" opacity={0.6}
                  />
                  <text x={toX(be)} y={PAD.top - 8} textAnchor="middle" fontSize={8} fill={gc.color} opacity={0.8}>
                    ₹{INR.format(be)}
                  </text>
                </g>
              ))}
            </g>
          ))}

          {/* Current spot vertical + dot per curve */}
          {inside(spotX) && (
            <g>
              <line
                x1={spotX} y1={PAD.top}
                x2={spotX} y2={PAD.top + DH}
                stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="5 3"
              />
              {renderedCurves.map((gc, gi) => {
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
            x={PAD.left} y={PAD.top}
            width={DW} height={DH}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={0.5}
          />
        </svg>
      </div>

      {/* Legs grouped by expiry */}
      <div className="rounded-lg border border-border/40 divide-y divide-border/40">
        {renderedCurves.map((gc, gi) => (
          <div key={gc.expiry}>
            <div className="flex items-center gap-2 px-3 py-1 bg-muted/20">
              <span className="inline-block h-2 w-4 rounded-full shrink-0" style={{ background: gc.color }} />
              <span className="text-[11px] font-medium text-muted-foreground">{gc.expiry}</span>
            </div>
            {groups[gi].legs.map((leg: Leg, i: number) => (
              <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs pl-7">
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground">{leg.index}</span>
                  <span className="font-mono font-medium">₹{INR.format(leg.strike)}</span>
                  <span className={cn("rounded px-1 py-0.5 text-[10px] font-bold", leg.instrumentType === "CE" ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400")}>
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
