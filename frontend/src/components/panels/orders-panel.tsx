import { useEffect, useRef, useState, useCallback } from "react";
import { useNewRows } from "@/hooks/use-new-rows";
import { RefreshCw, XCircle, AlertCircle, ChevronUp, ChevronDown, Inbox, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchOrders, cancelAllOrders, cancelOrder } from "@/services/trading-api";
import { OptionTypeBadge } from "@/components/panels/positions-panel/option-type-badge";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { useBrokerStore } from "@/stores/broker-store";
import { BROKERS } from "@/lib/constants";
import { BrokerBadge } from "@/components/ui/broker-badge";
import { RiskActivityLog } from "@/components/panels/risk-activity-log";
import { useRiskLogStore } from "@/stores/risk-log-store";
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
      ? "bg-green-500/15 text-green-500"
      : s === "rejected" || s.includes("cancel")
        ? "bg-red-500/15 text-red-500"
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

type Tab = "open" | "executed" | "risk-log";

interface OrdersPanelProps {
  expanded: boolean;
  onToggle: () => void;
  onRegisterRefresh?: (fn: () => void) => void;
}

export function OrdersPanel({ expanded, onToggle, onRegisterRefresh }: OrdersPanelProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("open");
  const riskLogEntryCount = useRiskLogStore((s) => s.entries.length);
  const lastSeenRiskCount = useRef(0);
  const hasUnreadRisk = tab !== "risk-log" && riskLogEntryCount > lastSeenRiskCount.current;

  const load = useCallback(async () => {
    const activeBrokers = BROKERS
      .map((b) => b.id)
      .filter((id) => {
        const token = useBrokerStore.getState().getCredentials(id)?.accessToken;
        return !isBrokerTokenExpired(id, token);
      });
    if (activeBrokers.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrders(activeBrokers);
      setOrders([...data].reverse());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    onRegisterRefresh?.(load);
  }, [load, onRegisterRefresh]);

  const handleCancelAll = async () => {
    setCancelling("all");
    try {
      await cancelAllOrders();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCancelling(null);
    }
  };

  const handleCancel = async (orderId: string) => {
    setCancelling(orderId);
    try {
      await cancelOrder(orderId);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCancelling(null);
    }
  };

  const orderKey = useCallback((o: Order) => o.orderId, []);
  const newOrderKeys = useNewRows(orders, orderKey);

  const openOrders = orders.filter((o) => !TERMINAL_STATUSES.has(o.status.toLowerCase()));
  const executedOrders = orders.filter((o) => TERMINAL_STATUSES.has(o.status.toLowerCase()));
  const visibleOrders = tab === "open" ? openOrders : executedOrders;
  const isRiskLog = tab === "risk-log";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className={cn("flex h-8 shrink-0 items-center gap-1 border-b border-border bg-muted/40 px-3", !expanded && "cursor-pointer")}
        onClick={!expanded ? onToggle : undefined}
      >
        <button
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium transition-colors",
            tab === "open"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={(e) => { if (expanded) e.stopPropagation(); setTab("open"); if (!expanded) onToggle(); }}
        >
          Open
          {openOrders.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {openOrders.length}
            </Badge>
          )}
        </button>
        <button
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium transition-colors",
            tab === "executed"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={(e) => { if (expanded) e.stopPropagation(); setTab("executed"); if (!expanded) onToggle(); }}
        >
          Executed
          {executedOrders.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {executedOrders.length}
            </Badge>
          )}
        </button>
        <button
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors",
            tab === "risk-log"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={(e) => {
            if (expanded) e.stopPropagation();
            setTab("risk-log");
            lastSeenRiskCount.current = riskLogEntryCount;
            if (!expanded) onToggle();
          }}
        >
          Events
          {hasUnreadRisk && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
          )}
        </button>

        <div className="ml-auto flex items-center gap-1">
          {error && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="size-3" />
              {error}
            </span>
          )}
          {expanded && tab === "open" && openOrders.length > 0 && (
            <Button
              size="sm"
              variant="destructive"
              className="h-6 px-2 text-xs"
              onClick={handleCancelAll}
              disabled={cancelling === "all"}
            >
              <XCircle className="mr-1 size-3" />
              Cancel All
            </Button>
          )}
          {expanded && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6"
                  onClick={load}
                  disabled={loading}
                >
                  <RefreshCw className={cn("size-3", loading && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                onClick={onToggle}
              >
                {expanded ? <ChevronDown className="size-5" /> : <ChevronUp className="size-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{expanded ? "Collapse" : "Expand"}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Body */}
      <div className={cn("flex-1 overflow-auto", !expanded && "hidden")}>
        {isRiskLog ? (
          <RiskActivityLog />
        ) : visibleOrders.length === 0 && !loading ? (
          <EmptyState
            icon={tab === "open" ? Inbox : CheckCircle2}
            message={tab === "open" ? "No open orders" : "No executed orders"}
          />
        ) : (
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
              {visibleOrders.map((o) => {
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
                        o.transactionType === "Buy" ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
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
                          className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleCancel(o.orderId)}
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
        )}
      </div>
    </div>
  );
}
