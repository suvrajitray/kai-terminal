import { useEffect, useState, useCallback } from "react";
import { ClipboardList, XCircle, AlertCircle } from "lucide-react";
import { PanelWrapper } from "./panel-wrapper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fetchOrders, cancelAllOrders, cancelOrder } from "@/services/trading-api";
import type { Order } from "@/types";

interface OrdersPanelProps {
  onClose: () => void;
}

const TERMINAL_STATUSES = new Set(["complete", "rejected", "cancelled"]);

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const s = status.toLowerCase();
  if (s === "complete") return "default";
  if (s === "rejected" || s === "cancelled") return "destructive";
  return "secondary";
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

export function OrdersPanel({ onClose }: OrdersPanelProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrders();
      // Show most recent first
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

  const activeOrders = orders.filter((o) => !TERMINAL_STATUSES.has(o.status.toLowerCase()));

  const actions = activeOrders.length > 0 && (
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
  );

  return (
    <PanelWrapper
      title="Orders"
      icon={<ClipboardList className="size-4 text-muted-foreground" />}
      onClose={onClose}
      onRefresh={load}
      loading={loading}
      actions={actions}
    >
      {error && (
        <div className="flex items-center gap-2 border-b border-border bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </div>
      )}

      {orders.length > 0 && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
          <span>{activeOrders.length} active · {orders.length - activeOrders.length} terminal</span>
        </div>
      )}

      {orders.length === 0 && !loading && !error ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No orders today
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Time</th>
              <th className="px-3 py-2 text-left font-medium">Symbol</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Side</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const isCancellable = !TERMINAL_STATUSES.has(o.status.toLowerCase());
              return (
                <tr
                  key={o.order_id}
                  className={cn(
                    "border-b border-border/50 transition-colors hover:bg-muted/30",
                    !isCancellable && "opacity-60",
                  )}
                >
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatTime(o.order_timestamp)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{o.trading_symbol}</div>
                    <div className="text-muted-foreground">{o.exchange} · {o.product}</div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{o.order_type}</td>
                  <td className={cn("px-3 py-2 font-medium", o.transaction_type === "BUY" ? "text-green-500" : "text-red-500")}>
                    {o.transaction_type}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <div>{o.filled_quantity}/{o.quantity}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {o.average_price > 0 ? `₹${fmt(o.average_price)}` : o.price > 0 ? `₹${fmt(o.price)}` : "MKT"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={statusVariant(o.status)} className="h-5 px-1.5 text-[10px] capitalize">
                      {o.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
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
    </PanelWrapper>
  );
}
