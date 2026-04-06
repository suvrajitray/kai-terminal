import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { PositionsPanel } from "@/components/panels/positions-panel";
import { OrdersPanel } from "@/components/panels/orders-panel";
import { StatsBar } from "@/components/terminal/stats-bar";
import { ProfitProtectionPanel } from "@/components/terminal/profit-protection-panel";
import { BrokerAuthRequired } from "@/components/terminal/broker-auth-required";
import { usePositionsFeed } from "@/components/panels/positions-panel/use-positions-feed";
import { useProfitProtection } from "./use-profit-protection";
import { useRiskConfig } from "@/hooks/use-risk-config";
import { useOptionContractsPrefetch } from "@/hooks/use-option-contracts-prefetch";
import { usePortfolioGreeks } from "@/hooks/use-portfolio-greeks";
import { exitAllPositions, exitAllZerodhaPositions } from "@/services/trading-api";
import { OptionChainPanel } from "@/components/panels/option-chain-panel";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useBrokerStore } from "@/stores/broker-store";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DEFAULT_ORDERS_HEIGHT = 300;
const MIN_HEIGHT = 32;

export function TerminalPage() {
  const credentials = useBrokerStore((s) => s.credentials);
  const brokerEntries = Object.entries(credentials);
  const hasValid = brokerEntries.some(([id, c]) => !isBrokerTokenExpired(id, c?.accessToken));
  const hasExpired = brokerEntries.length > 0 && brokerEntries.every(([id, c]) => isBrokerTokenExpired(id, c?.accessToken));

  if (!hasValid) {
    return <BrokerAuthRequired expired={hasExpired} />;
  }

  return <TerminalPageInner />;
}

function TerminalPageInner() {
  const credentials = useBrokerStore((s) => s.credentials);
  const loadOrdersRef = useRef<(() => void) | null>(null);
  const { positions, setPositions, loading, isLive, load } = usePositionsFeed(
    () => loadOrdersRef.current?.()
  );
  const [acting, setActing] = useState<string | null>(null);
  const [ordersHeight, setOrdersHeight] = useState(MIN_HEIGHT);
  const [ordersExpanded, setOrdersExpanded] = useState(false);
  const [ppOpen, setPpOpen] = useState(false);
  const [chainOpen, setChainOpen] = useState(true);
  const [chainWidth, setChainWidth] = useState(400);
  const [exitAllConfirmOpen, setExitAllConfirmOpen] = useState(false);
  const [productFilter, setProductFilter] = useState<"Intraday" | "Delivery" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef<number>(DEFAULT_ORDERS_HEIGHT);
  const lastExpandedHeight = useRef<number>(DEFAULT_ORDERS_HEIGHT);

  const handleOrdersToggle = () => {
    if (ordersExpanded) {
      lastExpandedHeight.current = ordersHeight;
      setOrdersHeight(MIN_HEIGHT);
      setOrdersExpanded(false);
    } else {
      setOrdersHeight(lastExpandedHeight.current);
      setOrdersExpanded(true);
    }
  };

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
  const { netDelta, thetaPerDay, netGamma, netVega } = usePortfolioGreeks(positions);

  // Hooks must be called unconditionally — one set per known broker in BROKERS.
  // When adding a new broker (e.g. "dhan"), add useRiskConfig, useProfitProtection,
  // getConfig, and one entry in ppBrokers below.
  useRiskConfig("upstox");
  useRiskConfig("zerodha");
  useRiskConfig("dhan");
  const { currentSl: upstoxSl }  = useProfitProtection("upstox");
  const { currentSl: zerodhasl } = useProfitProtection("zerodha");
  const { currentSl: dhanSl }    = useProfitProtection("dhan");
  const upstoxPp  = useProfitProtectionStore((s) => s.getConfig("upstox"));
  const zerodhaP  = useProfitProtectionStore((s) => s.getConfig("zerodha"));
  const dhanPp    = useProfitProtectionStore((s) => s.getConfig("dhan"));

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
  }, [load, positions]);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartHeight.current = ordersHeight;
    setIsDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      if (dragStartY.current === null) return;
      const delta = dragStartY.current - ev.clientY;
      const next = Math.max(MIN_HEIGHT, dragStartHeight.current + delta);
      setOrdersHeight(next);
      setOrdersExpanded(next > MIN_HEIGHT);
    };

    const onMouseUp = () => {
      dragStartY.current = null;
      setIsDragging(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [ordersHeight]);


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
          onOpenProfitProtection={() => setPpOpen(true)}
          onToggleChain={() => setChainOpen((v) => !v)}
          chainOpen={chainOpen}
          productFilter={productFilter}
          ppBrokers={[
            upstoxPp.enabled ? { broker: "upstox",  target: upstoxPp.mtmTarget, currentSl: upstoxSl,  trailing: upstoxPp.trailingEnabled } : null,
            zerodhaP.enabled ? { broker: "zerodha", target: zerodhaP.mtmTarget, currentSl: zerodhasl, trailing: zerodhaP.trailingEnabled } : null,
            dhanPp.enabled   ? { broker: "dhan",    target: dhanPp.mtmTarget,   currentSl: dhanSl,    trailing: dhanPp.trailingEnabled }   : null,
          ].filter((x): x is NonNullable<typeof x> => x !== null)}
        />

        {/* Positions — flex-1, scrollable */}
        <div className={cn("flex-1 overflow-hidden", !isDragging && "transition-[padding-bottom] duration-200 ease-in-out")} style={{ paddingBottom: ordersHeight }}>
          <PositionsPanel
            positions={positions}
            setPositions={setPositions}
            loading={loading}
            isLive={isLive}
            load={load}
            productFilter={productFilter}
            onProductFilterChange={setProductFilter}
            netDelta={netDelta}
            thetaPerDay={thetaPerDay}
            netGamma={netGamma}
            netVega={netVega}
          />
        </div>

        {/* Orders — pinned bottom, resizable */}
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
      </div>

      {/* Right column — option chain panel */}
      {chainOpen && <OptionChainPanel width={chainWidth} onResize={setChainWidth} onClose={() => setChainOpen(false)} netDelta={netDelta} />}

      {/* Profit Protection config dialog */}
      <ProfitProtectionPanel
        open={ppOpen}
        onClose={() => setPpOpen(false)}
        positions={positions}
      />

      {/* Exit All confirmation (triggered by E key or button) */}
      <AlertDialog open={exitAllConfirmOpen} onOpenChange={setExitAllConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit {openCount} open position{openCount !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              Market exit orders will be placed for all {openCount} open position{openCount !== 1 ? "s" : ""}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setExitAllConfirmOpen(false); handleExitAll(); }}
            >
              Exit All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
