import { memo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrokerBadge } from "@/components/ui/broker-badge";
import { OptionTypeBadge } from "@/components/panels/positions-panel/option-type-badge";
import type { Order } from "@/types";

const TERMINAL_STATUSES = new Set(["complete", "rejected", "cancelled"]);

const PRODUCT_LABEL: Record<string, string> = {
  Intraday: "Intraday", Delivery: "Delivery", Mtf: "MTF", CoverOrder: "Cover Order",
};
function productLabel(p: string) { return PRODUCT_LABEL[p] ?? p; }

// Upstox option symbol parser
// Weekly format:  {UNDERLYING}{YY}{M}{DD}{STRIKE}{TYPE}  e.g. NIFTY2631723100PE
// Monthly format: {UNDERLYING}{YY}{MMM}{STRIKE}{TYPE}   e.g. NIFTY26MAR23100PE
const MONTH_ABBR = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const WEEKLY_MONTH: Record<string, number> = {
  "1":1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"O":10,"N":11,"D":12,
};
const KNOWN_UNDERLYINGS = ["BANKNIFTY","MIDCPNIFTY","FINNIFTY","SENSEX","BANKEX","NIFTY"];

interface ParsedOption { underlying: string; strike: number; type: "CE" | "PE"; expiryLabel: string; }

function parseOptionSymbol(symbol: string): ParsedOption | null {
  const type = symbol.endsWith("CE") ? "CE" : symbol.endsWith("PE") ? "PE" : null;
  if (!type) return null;
  const body = symbol.slice(0, -2);
  let underlying = "", rest = "";
  for (const u of KNOWN_UNDERLYINGS) {
    if (body.startsWith(u)) { underlying = u; rest = body.slice(u.length); break; }
  }
  if (!underlying || rest.length < 5) return null;
  const yy = rest.slice(0, 2);
  rest = rest.slice(2);
  const upper3 = rest.slice(0, 3).toUpperCase();
  const monthIdx = MONTH_ABBR.indexOf(upper3);
  let expiryLabel: string;
  let strike: number;
  if (monthIdx >= 0) {
    // Monthly: MMM + STRIKE
    strike = parseInt(rest.slice(3), 10);
    expiryLabel = `${upper3}${yy}`;
  } else {
    // Weekly: M (single char) + DD (2 chars) + STRIKE
    const month = WEEKLY_MONTH[rest[0].toUpperCase()];
    if (!month) return null;
    const dd = rest.slice(1, 3);
    strike = parseInt(rest.slice(3), 10);
    expiryLabel = `${dd}${MONTH_ABBR[month - 1]}${yy}`;
  }
  if (isNaN(strike)) return null;
  return { underlying, strike, type, expiryLabel };
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const styles =
    s === "complete"
      ? "bg-emerald-500/15 text-emerald-500"
      : s === "rejected" || s.includes("cancel")
        ? "bg-rose-500/15 text-rose-500"
        : s === "open" || s === "pending" || s === "trigger pending"
          ? "bg-amber-500/15 text-amber-500"
          : "bg-muted text-muted-foreground";

  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize ${styles}`}>
      {status}
    </span>
  );
}

function formatTime(ts: string | null) {
  if (!ts) return "--";
  try {
    return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts;
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export interface OrdersTableProps {
  orders: Order[];
  cancelling: string | null;
  newOrderKeys: Set<string>;
  onCancel: (orderId: string, broker?: string) => void;
}

export const OrdersTable = memo(function OrdersTable({ orders, cancelling, newOrderKeys, onCancel }: OrdersTableProps) {
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 z-10 bg-muted/20 backdrop-blur-sm">
        <tr className="border-b border-border text-muted-foreground">
          <th className="px-3 py-1.5 text-left font-medium">Time</th>
          <th className="px-3 py-1.5 text-left font-medium">Symbol</th>
          <th className="px-3 py-1.5 text-left font-medium">Type</th>
          <th className="px-3 py-1.5 text-left font-medium">Side</th>
          <th className="px-3 py-1.5 text-right font-medium">Qty</th>
          <th className="px-3 py-1.5 text-right font-medium">Price</th>
          <th className="px-3 py-1.5 text-left font-medium">Status</th>
          <th className="px-3 py-1.5 text-right font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => {
          const s = o.status.toLowerCase();
          const isCancellable = !TERMINAL_STATUSES.has(s) && !s.includes("cancel") && !s.includes("rejected");
          return (
            <tr
              key={o.orderId}
              className={cn(
                "border-b border-border/50 transition-colors hover:bg-muted/30",
                !isCancellable && "opacity-60",
                newOrderKeys.has(o.orderId) && "animate-row-enter",
              )}
            >
              <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                {formatTime(o.orderTimestamp)}
              </td>
              <td className="px-3 py-1.5">
                {(() => {
                  const parsed = parseOptionSymbol(o.tradingSymbol);
                  return parsed ? (
                    <>
                      <div className="flex items-center gap-1.5 font-medium">
                        {parsed.underlying} {parsed.strike}
                        <OptionTypeBadge type={parsed.type} />
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {o.broker && <BrokerBadge brokerId={o.broker} size={12} />}
                        {o.exchange} {parsed.expiryLabel} · {productLabel(o.product)}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-medium">{o.tradingSymbol}</div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {o.broker && <BrokerBadge brokerId={o.broker} size={12} />}
                        {o.exchange} · {productLabel(o.product)}
                      </div>
                    </>
                  );
                })()}
              </td>
              <td className="px-3 py-1.5 text-muted-foreground">{o.orderType}</td>
              <td className="px-3 py-1.5">
                <span className={cn(
                  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold",
                  o.transactionType === "Buy" ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"
                )}>
                  {o.transactionType}
                </span>
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {o.filledQuantity}/{o.quantity}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {o.averagePrice > 0 ? `₹${fmt(o.averagePrice)}` : o.price > 0 ? `₹${fmt(o.price)}` : "MKT"}
              </td>
              <td className="px-3 py-1.5">
                <StatusBadge status={o.status} />
              </td>
              <td className="px-3 py-1.5 text-right">
                {isCancellable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive active:scale-[0.98]"
                    onClick={() => onCancel(o.orderId, o.broker)}
                    disabled={cancelling === o.orderId}
                  >
                    Cancel
                  </Button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
});
