import { useEffect, useState, useCallback } from "react";
import { RefreshCw, XCircle, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fetchOrders, cancelAllOrders, cancelOrder } from "@/services/trading-api";
import type { Order } from "@/types";

const TERMINAL_STATUSES = new Set(["complete", "rejected", "cancelled"]);

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

type Tab = "open" | "executed";

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrders();
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

  const openOrders = orders.filter((o) => !TERMINAL_STATUSES.has(o.status.toLowerCase()));
  const executedOrders = orders.filter((o) => TERMINAL_STATUSES.has(o.status.toLowerCase()));
  const visibleOrders = tab === "open" ? openOrders : executedOrders;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border bg-muted/40 px-3">
        <button
          className={cn(
            "flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium transition-colors",
            tab === "open"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setTab("open")}
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
            "flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium transition-colors",
            tab === "executed"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setTab("executed")}
        >
          Executed
          {executedOrders.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {executedOrders.length}
            </Badge>
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
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              onClick={load}
              disabled={loading}
              title="Refresh"
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={onToggle}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown className="size-5" /> : <ChevronUp className="size-5" />}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className={cn("flex-1 overflow-auto", !expanded && "hidden")}>
        {visibleOrders.length === 0 && !loading ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {tab === "open" ? "No open orders" : "No executed orders"}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background">
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
                    key={o.order_id}
                    className={cn(
                      "border-b border-border/50 transition-colors hover:bg-muted/30",
                      !isCancellable && "opacity-60",
                    )}
                  >
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                      {formatTime(o.order_timestamp)}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="font-medium">{o.trading_symbol}</div>
                      <div className="text-muted-foreground">{o.exchange} · {o.product}</div>
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{o.order_type}</td>
                    <td className={cn("px-3 py-1.5 font-medium", o.transaction_type === "BUY" ? "text-green-500" : "text-red-500")}>
                      {o.transaction_type}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {o.filled_quantity}/{o.quantity}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {o.average_price > 0 ? `₹${fmt(o.average_price)}` : o.price > 0 ? `₹${fmt(o.price)}` : "MKT"}
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
                          onClick={() => handleCancel(o.order_id)}
                          disabled={cancelling === o.order_id}
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
