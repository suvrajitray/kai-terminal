import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { PositionsPanel } from "@/components/panels/positions-panel";
import { OrdersPanel } from "@/components/panels/orders-panel";
import { StatsBar } from "@/components/terminal/stats-bar";
import { usePositionsFeed } from "@/components/panels/positions-panel/use-positions-feed";
import { useOptionContractsPrefetch } from "@/hooks/use-option-contracts-prefetch";
import { usePortfolioGreeks } from "@/hooks/use-portfolio-greeks";
import { useBrokerPpStatus } from "@/hooks/use-broker-pp-status";
import { exitAllPositions, exitAllZerodhaPositions } from "@/services/trading-api";
import { OptionChainPanel } from "@/components/panels/option-chain-panel";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useBrokerStore } from "@/stores/broker-store";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { useOrdersPanelResize } from "./use-orders-panel-resize";
import { ExitAllDialog } from "./exit-all-dialog";

export function TerminalPage() {
  const credentials     = useBrokerStore((s) => s.credentials);
  const hasValidBroker = Object.entries(credentials).some(
    ([id, c]) => !isBrokerTokenExpired(id, c?.accessToken),
  );
  const loadOrdersRef = useRef<(() => void) | null>(null);
  const { positions, loading, isLive, load } = usePositionsFeed(
    () => loadOrdersRef.current?.()
  );
  const [acting, setActing] = useState<string | null>(null);
  const [chainOpen, setChainOpen] = useState(true);
  const [chainWidth, setChainWidth] = useState(400);
  const [exitAllConfirmOpen, setExitAllConfirmOpen] = useState(false);
  const [productFilter, setProductFilter] = useState<"Intraday" | "Delivery" | null>(null);
  const { ordersHeight, ordersExpanded, isDragging, handleOrdersToggle, onDragStart } = useOrdersPanelResize();

  const handleExitAll = async () => {
    setActing("all");
    try {
      // Exit all open positions across every active broker in parallel
      const activeBrokers = Object.entries(credentials).filter(
        ([id, c]) => !isBrokerTokenExpired(id, c?.accessToken),
      );
      const calls: Promise<void>[] = [];
      if (activeBrokers.some(([id]) => id === "upstox"))   calls.push(exitAllPositions());
      if (activeBrokers.some(([id]) => id === "zerodha"))  calls.push(exitAllZerodhaPositions());
      await Promise.all(calls);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(null);
    }
  };

  useOptionContractsPrefetch();
  const { netDelta, thetaPerDay } = usePortfolioGreeks(positions);
  const ppBrokers = useBrokerPpStatus();

  const openCount = positions.filter((p) => p.quantity !== 0).length;

  // Keyboard shortcuts: R = refresh, E = exit all (with confirm)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "r" || e.key === "R") { e.preventDefault(); load(); }
      if (e.key === "e" || e.key === "E") {
        if (openCount > 0) { e.preventDefault(); setExitAllConfirmOpen(true); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [load, openCount]);


  return (
    <div className="flex h-[calc(100svh-3.5rem)] overflow-hidden">
      {/* Left column — positions + orders */}
      <div className="relative flex flex-1 min-w-0 flex-col overflow-hidden">
        {/* Stats bar */}
        <StatsBar
          positions={positions}
          isLive={isLive}
          loading={loading}
          acting={acting}
          onRefresh={load}
          onExitAll={() => setExitAllConfirmOpen(true)}
          onOpenProfitProtection={(brokerId?: string) => useProfitProtectionStore.getState().requestOpen(brokerId ?? "upstox")}
          onToggleChain={() => setChainOpen((v) => !v)}
          chainOpen={chainOpen}
          productFilter={productFilter}
          ppBrokers={ppBrokers}
          hasValidBroker={hasValidBroker}
        />

        {/* Positions — flex-1, scrollable */}
        <div className={cn("flex-1 overflow-hidden", !isDragging && "transition-[padding-bottom] duration-200 ease-in-out")} style={{ paddingBottom: hasValidBroker ? ordersHeight : 0 }}>
          <PositionsPanel
            positions={positions}
            loading={loading}
            load={load}
            hasValidBroker={hasValidBroker}
            productFilter={productFilter}
            onProductFilterChange={setProductFilter}
            netDelta={netDelta}
            thetaPerDay={thetaPerDay}
          />
        </div>

        {/* Orders — pinned bottom, resizable */}
        {hasValidBroker && (
          <div
            className={cn("absolute bottom-0 left-0 right-0 border-t border-border bg-background", !isDragging && "transition-[height] duration-200 ease-in-out")}
            style={{ height: ordersHeight }}
          >
            <div
              className="group absolute -top-2 left-0 right-0 h-4 cursor-row-resize z-10 flex items-center justify-center"
              onMouseDown={onDragStart}
              title="Drag to resize"
            >
              <div className="h-1 w-12 rounded-full bg-border/60 transition-colors group-hover:bg-primary/60 group-active:bg-primary" />
            </div>
            <OrdersPanel
              expanded={ordersExpanded}
              onToggle={handleOrdersToggle}
              onRegisterRefresh={(fn) => { loadOrdersRef.current = fn; }}
            />
          </div>
        )}
      </div>

      {/* Right column — option chain panel */}
      {chainOpen && <OptionChainPanel width={chainWidth} onResize={setChainWidth} onClose={() => setChainOpen(false)} netDelta={netDelta} />}

      <ExitAllDialog
        open={exitAllConfirmOpen}
        openCount={openCount}
        onOpenChange={setExitAllConfirmOpen}
        onConfirm={handleExitAll}
      />
    </div>
  );
}
