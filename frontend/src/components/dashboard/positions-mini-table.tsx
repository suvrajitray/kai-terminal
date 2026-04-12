import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptionContractsStore, formatExpiryLabel } from "@/stores/option-contracts-store";
import { OptionTypeBadge } from "@/components/panels/positions-panel/option-type-badge";
import type { Position } from "@/types";

const INR = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 });

function PnlCell({ value }: { value: number }) {
  const color = value > 0 ? "text-emerald-500" : value < 0 ? "text-rose-500" : "text-muted-foreground";
  return (
    <span className={cn("font-mono tabular-nums", color)}>
      {value >= 0 ? "+" : "-"}₹{INR.format(Math.abs(value))}
    </span>
  );
}

interface PositionsMiniTableProps {
  positions: Position[];
  loading: boolean;
}

export function PositionsMiniTable({ positions, loading }: PositionsMiniTableProps) {
  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);
  const open = positions.filter((p) => p.quantity !== 0);

  return (
    <Card className="border-border/40 bg-muted/10 flex flex-col">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Open Positions
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0 flex-1 flex flex-col">
        {loading ? (
          <div className="overflow-hidden">
            <table className="w-full text-xs">
              <tbody>
                {[0, 1, 2].map((i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="px-4 py-1.5">
                      <Skeleton className="mb-1 h-3.5 w-24" />
                      <Skeleton className="h-2.5 w-16" />
                    </td>
                    <td className="px-3 py-1.5 text-right"><Skeleton className="ml-auto h-3.5 w-8" /></td>
                    <td className="px-3 py-1.5 text-right"><Skeleton className="ml-auto h-3.5 w-14" /></td>
                    <td className="px-3 py-1.5 text-right"><Skeleton className="ml-auto h-3.5 w-14" /></td>
                    <td className="px-4 py-1.5 text-right"><Skeleton className="ml-auto h-3.5 w-16" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : open.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-10 text-xs text-muted-foreground">
            No open positions
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="max-h-52 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40 text-left">
                    <th className="px-4 py-1.5 text-muted-foreground font-medium">Symbol</th>
                    <th className="px-3 py-1.5 text-right text-muted-foreground font-medium">Qty</th>
                    <th className="px-3 py-1.5 text-right text-muted-foreground font-medium">Avg</th>
                    <th className="px-3 py-1.5 text-right text-muted-foreground font-medium">LTP</th>
                    <th className="px-4 py-1.5 text-right text-muted-foreground font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {open.map((p) => {
                    const avg = p.quantity < 0 ? p.sellPrice : p.buyPrice;
                    const lookup = getByInstrumentKey(p.instrumentToken);
                    const contract = lookup?.contract;
                    const index = lookup?.index;
                    return (
                      <tr
                        key={p.instrumentToken}
                        className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-1.5">
                          {contract ? (
                            <>
                              <div className="flex items-center gap-1.5 font-medium">
                                {index} {contract.strikePrice}
                                <OptionTypeBadge type={contract.instrumentType} />
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {p.exchange} / {formatExpiryLabel(contract.expiry)}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-medium">{p.tradingSymbol}</div>
                              <div className="text-[10px] text-muted-foreground">{p.exchange}</div>
                            </>
                          )}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-1.5 text-right font-mono tabular-nums font-semibold",
                            p.quantity < 0 ? "text-rose-500" : "text-emerald-500",
                          )}
                        >
                          {p.quantity > 0 ? "+" : ""}{p.quantity}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                          ₹{INR.format(avg)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                          ₹{INR.format(p.ltp)}
                        </td>
                        <td className="px-4 py-1.5 text-right">
                          <PnlCell value={p.pnl} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer link */}
            <div className="border-t border-border/30 px-4 py-2.5">
              <Link
                to="/terminal"
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                View all in Terminal
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
