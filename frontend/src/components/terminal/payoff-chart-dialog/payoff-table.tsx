import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { payoffAt } from "./use-payoff-data";
import type { ExpiryGroup } from "./use-payoff-data";

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function fmt(v: number): string {
  return (v >= 0 ? "+" : "−") + "₹" + INR.format(Math.abs(v));
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
  }, []);

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
  const steps = Array.from({ length: 21 }, (_, i) => anchor + (i - 10) * interval)
    .filter((p) => Math.abs(p - spot) > interval / 2);

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

            {steps.map((price) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
