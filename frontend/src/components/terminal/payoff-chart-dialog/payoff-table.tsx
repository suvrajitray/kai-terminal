import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { payoffAt } from "./use-payoff-data";
import type { ExpiryGroup } from "./use-payoff-data";

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function fmtPnl(v: number): string {
  return INR.format(Math.round(v));
}

function fmtPct(price: number, spot: number): string {
  const p = ((price - spot) / spot) * 100;
  return (p >= 0 ? "+" : "") + p.toFixed(2) + "%";
}

function fmtExpiryHeader(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[dt.getDay()]}, ${d} ${months[m - 1]}`;
}

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

  const belowPrices = Array.from({ length: 9 }, (_, i) => anchor - (9 - i) * interval)
    .filter((p) => p > 0 && p < spot - interval / 2);
  const abovePrices = Array.from({ length: 9 }, (_, i) => anchor + (i + 1) * interval)
    .filter((p) => p > spot + interval / 2);

  return (
    <div className="overflow-hidden rounded-lg border border-border/40">
      <div className="max-h-[320px] overflow-y-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 border-b border-border/30 bg-background">
            <tr>
              <th className="px-4 py-[9px] text-left font-medium text-muted-foreground">
                Target
              </th>
              {groups.map((g, i) => (
                <th key={g.expiry} className="px-4 py-[9px] text-right font-medium text-muted-foreground">
                  On Expiry:{" "}
                  <span style={{ color: groupColors[i] ?? "#94a3b8" }}>
                    {fmtExpiryHeader(g.expiry)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {belowPrices.map((price) => {
              const pct = fmtPct(price, spot);
              const down = ((price - spot) / spot) * 100 < 0;
              return (
                <tr key={price} className="border-b border-border/20 transition-colors hover:bg-muted/10">
                  <td className="px-4 py-[7px]">
                    <span className="tabular-nums text-foreground">{INR.format(price)}</span>
                    <span className={cn("ml-1.5 text-[11px]", down ? "text-rose-500/70" : "text-emerald-500/70")}>
                      ({pct})
                    </span>
                  </td>
                  {groups.map((g) => {
                    const pnl = payoffAt(g.legs, price);
                    return (
                      <td key={g.expiry} className={cn(
                        "px-4 py-[7px] text-right font-mono tabular-nums",
                        pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {fmtPnl(pnl)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Spot row */}
            <tr ref={spotRowRef} className="border-y border-amber-800/30 bg-amber-950/50">
              <td className="px-4 py-[7px]">
                <span className="tabular-nums font-medium text-foreground">{INR.format(Math.round(spot))}</span>
                <span className="ml-1.5 text-[11px] text-amber-500/80">(0.00%)</span>
              </td>
              {groups.map((g) => {
                const pnl = payoffAt(g.legs, spot);
                return (
                  <td key={g.expiry} className={cn(
                    "px-4 py-[7px] text-right font-mono tabular-nums font-medium",
                    pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {fmtPnl(pnl)}
                  </td>
                );
              })}
            </tr>

            {abovePrices.map((price) => {
              const pct = fmtPct(price, spot);
              const up = ((price - spot) / spot) * 100 > 0;
              return (
                <tr key={price} className="border-b border-border/20 transition-colors hover:bg-muted/10">
                  <td className="px-4 py-[7px]">
                    <span className="tabular-nums text-foreground">{INR.format(price)}</span>
                    <span className={cn("ml-1.5 text-[11px]", up ? "text-emerald-500/70" : "text-rose-500/70")}>
                      ({pct})
                    </span>
                  </td>
                  {groups.map((g) => {
                    const pnl = payoffAt(g.legs, price);
                    return (
                      <td key={g.expiry} className={cn(
                        "px-4 py-[7px] text-right font-mono tabular-nums",
                        pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {fmtPnl(pnl)}
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
