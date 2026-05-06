import { useEffect, useState, useCallback } from "react";
import { useNewRows } from "@/hooks/use-new-rows";
import { Inbox, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { RiskActivityLog } from "@/components/panels/risk-activity-log";
import { useRiskLogStore } from "@/stores/risk-log-store";
import { OrdersTable } from "@/components/panels/orders-panel/orders-table";
import { useOrdersState } from "@/components/panels/orders-panel/use-orders-state";
import { useOrdersActions } from "@/components/panels/orders-panel/use-orders-actions";
import { OrdersPanelHeader } from "@/components/panels/orders-panel/orders-panel-header";
import { OrdersBrokerFilter } from "@/components/panels/orders-panel/orders-broker-filter";
import type { Tab } from "@/components/panels/orders-panel/orders-panel-header";
import type { Order } from "@/types";

const TERMINAL_STATUSES = new Set(["complete", "rejected", "cancelled"]);

interface OrdersPanelProps {
  expanded: boolean;
  onToggle: () => void;
  onRegisterRefresh?: (fn: () => void) => void;
}

export function OrdersPanel({ expanded, onToggle, onRegisterRefresh }: OrdersPanelProps) {
  const state = useOrdersState();
  const { orders, loading, error, cancelling, loadStart, loadSuccess, loadError, cancelStart, cancelDone, cancelError } = state;
  const [tab, setTab] = useState<Tab>("open");
  const [brokerFilter, setBrokerFilter] = useState<string | null>(null);
  const riskLogEntryCount = useRiskLogStore((s) => s.entries.length);
  const [lastSeenRiskCount, setLastSeenRiskCount] = useState(0);

  const { load, handleCancelAll, handleCancel } = useOrdersActions({
    loadStart, loadSuccess, loadError, cancelStart, cancelDone, cancelError,
  });

  useEffect(() => { load(); }, [load]);
  useEffect(() => { onRegisterRefresh?.(load); }, [load, onRegisterRefresh]);

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
      <OrdersPanelHeader
        expanded={expanded}
        tab={tab}
        openOrders={openOrders}
        executedOrders={executedOrders}
        loading={loading}
        error={error}
        cancelling={cancelling}
        riskLogEntryCount={riskLogEntryCount}
        lastSeenRiskCount={lastSeenRiskCount}
        onToggle={onToggle}
        onTabChange={setTab}
        onLoad={load}
        onCancelAll={() => handleCancelAll(openOrders)}
        onMarkRiskSeen={() => setLastSeenRiskCount(riskLogEntryCount)}
      />

      {expanded && !isRiskLog && brokersInOrders.length > 1 && (
        <OrdersBrokerFilter
          brokerIds={brokersInOrders}
          selected={brokerFilter}
          onSelect={setBrokerFilter}
        />
      )}

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
