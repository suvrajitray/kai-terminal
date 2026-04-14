import { useEffect, useState, useCallback, useReducer } from "react";
import { useNewRows } from "@/hooks/use-new-rows";
import { RefreshCw, XCircle, AlertCircle, ChevronUp, ChevronDown, Inbox, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchOrders, cancelAllOrders, cancelOrder } from "@/services/trading-api";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { useBrokerStore } from "@/stores/broker-store";
import { BROKERS } from "@/lib/constants";
import { BrokerBadge } from "@/components/ui/broker-badge";
import { RiskActivityLog } from "@/components/panels/risk-activity-log";
import { useRiskLogStore } from "@/stores/risk-log-store";
import { OrdersTable } from "@/components/panels/orders-panel/orders-table";
import type { Order } from "@/types";

const TERMINAL_STATUSES = new Set(["complete", "rejected", "cancelled"]);

// --- Reducer ---

interface OrdersState {
  orders: Order[];
  loading: boolean;
  error: string | null;
  cancelling: string | null;
}

type OrdersAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; orders: Order[] }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "CANCEL_START"; id: string }
  | { type: "CANCEL_DONE" }
  | { type: "CANCEL_ERROR"; error: string };

function ordersReducer(state: OrdersState, action: OrdersAction): OrdersState {
  switch (action.type) {
    case "LOAD_START":   return { ...state, loading: true, error: null };
    case "LOAD_SUCCESS": return { ...state, loading: false, orders: action.orders };
    case "LOAD_ERROR":   return { ...state, loading: false, error: action.error };
    case "CANCEL_START": return { ...state, cancelling: action.id };
    case "CANCEL_DONE":  return { ...state, cancelling: null };
    case "CANCEL_ERROR": return { ...state, cancelling: null, error: action.error };
    default: return state;
  }
}

// --- Component ---

type Tab = "open" | "executed" | "risk-log";

interface OrdersPanelProps {
  expanded: boolean;
  onToggle: () => void;
  onRegisterRefresh?: (fn: () => void) => void;
}

export function OrdersPanel({ expanded, onToggle, onRegisterRefresh }: OrdersPanelProps) {
  const [state, dispatch] = useReducer(ordersReducer, { orders: [], loading: false, error: null, cancelling: null });
  const { orders, loading, error, cancelling } = state;
  const [tab, setTab] = useState<Tab>("open");
  const [brokerFilter, setBrokerFilter] = useState<string | null>(null);
  const riskLogEntryCount = useRiskLogStore((s) => s.entries.length);
  const [lastSeenRiskCount, setLastSeenRiskCount] = useState(0);
  const hasUnreadRisk = tab !== "risk-log" && riskLogEntryCount > lastSeenRiskCount;

  const load = useCallback(async () => {
    const activeBrokers = BROKERS
      .map((b) => b.id)
      .filter((id) => {
        const token = useBrokerStore.getState().getCredentials(id)?.accessToken;
        return !isBrokerTokenExpired(id, token);
      });
    if (activeBrokers.length === 0) return;
    dispatch({ type: "LOAD_START" });
    try {
      const data = await fetchOrders(activeBrokers);
      dispatch({ type: "LOAD_SUCCESS", orders: [...data].reverse() });
    } catch (e) {
      dispatch({ type: "LOAD_ERROR", error: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    onRegisterRefresh?.(load);
  }, [load, onRegisterRefresh]);

  const handleCancelAll = async () => {
    dispatch({ type: "CANCEL_START", id: "all" });
    try {
      await cancelAllOrders();
      await load();
      dispatch({ type: "CANCEL_DONE" });
    } catch (e) {
      dispatch({ type: "CANCEL_ERROR", error: (e as Error).message });
    }
  };

  const handleCancel = async (orderId: string) => {
    dispatch({ type: "CANCEL_START", id: orderId });
    try {
      await cancelOrder(orderId);
      await load();
      dispatch({ type: "CANCEL_DONE" });
    } catch (e) {
      dispatch({ type: "CANCEL_ERROR", error: (e as Error).message });
    }
  };

  const orderKey = useCallback((o: Order) => o.orderId, []);
  const newOrderKeys = useNewRows(orders, orderKey);

  const brokersInOrders = [...new Set(orders.map((o) => o.broker).filter(Boolean))] as string[];
  const openOrders = orders.filter((o) => !TERMINAL_STATUSES.has(o.status.toLowerCase()));
  const executedOrders = orders.filter((o) => TERMINAL_STATUSES.has(o.status.toLowerCase()));
  const baseOrders = tab === "open" ? openOrders : executedOrders;
  const visibleOrders = brokerFilter ? baseOrders.filter((o) => o.broker === brokerFilter) : baseOrders;
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
            setLastSeenRiskCount(riskLogEntryCount);
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

      {/* Broker filter bar — only when expanded, not on risk-log tab, and multiple brokers present */}
      {expanded && !isRiskLog && brokersInOrders.length > 1 && (
        <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border/40 bg-muted/20 px-3">
          <button
            onClick={() => setBrokerFilter(null)}
            className={cn(
              "cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
              brokerFilter === null
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {brokersInOrders.map((bId) => (
            <button
              key={bId}
              onClick={() => setBrokerFilter(brokerFilter === bId ? null : bId)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                brokerFilter === bId
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <BrokerBadge brokerId={bId} size={12} />
              <span className="capitalize">{bId}</span>
            </button>
          ))}
        </div>
      )}

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
          <OrdersTable
            orders={visibleOrders}
            cancelling={cancelling}
            newOrderKeys={newOrderKeys}
            onCancel={handleCancel}
          />
        )}
      </div>
    </div>
  );
}
