import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { PositionsPanel } from "@/components/panels/positions-panel";
import { OrdersPanel } from "@/components/panels/orders-panel";
import { StatsBar } from "@/components/terminal/stats-bar";
import { ProfitProtectionPanel } from "@/components/terminal/profit-protection-panel";
import { BrokerAuthRequired } from "@/components/terminal/broker-auth-required";
import { usePositionsFeed } from "@/components/panels/positions-panel/use-positions-feed";
import { exitAllPositions } from "@/services/trading-api";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useBrokerStore } from "@/stores/broker-store";
import { isTokenExpired } from "@/lib/token-utils";

const DEFAULT_ORDERS_HEIGHT = 180;
const MIN_HEIGHT = 32;

export function TerminalPage() {
  const token = useBrokerStore((s) => s.getCredentials("upstox")?.accessToken);
  if (!token || isTokenExpired(token)) {
    return <BrokerAuthRequired expired={!!token} />;
  }

  return <TerminalPageInner />;
}

function TerminalPageInner() {
  const loadOrdersRef = useRef<(() => void) | null>(null);
  const { positions, setPositions, loading, isLive, load } = usePositionsFeed(
    () => loadOrdersRef.current?.()
  );
  const [acting, setActing] = useState<string | null>(null);
  const [ordersHeight, setOrdersHeight] = useState(MIN_HEIGHT);
  const [ordersExpanded, setOrdersExpanded] = useState(false);
  const [ppOpen, setPpOpen] = useState(false);
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

  // Profit protection monitoring state
  const pp = useProfitProtectionStore();
  const trailSlRef = useRef<number>(pp.mtmSl);      // current trailing SL floor
  const lastStepRef = useRef<number>(0);              // last MTM checkpoint for step logic
  const firedRef = useRef(false);                     // prevent double-fire
  const [currentSl, setCurrentSl] = useState<number>(pp.mtmSl); // reactive copy for display

  // Reset trail state whenever PP config changes or gets enabled
  useEffect(() => {
    trailSlRef.current = pp.mtmSl;
    lastStepRef.current = 0;
    firedRef.current = false;
    setCurrentSl(pp.mtmSl);
  }, [pp.enabled, pp.mtmSl, pp.increaseBy, pp.trailBy]);

  // Monitor MTM on every positions update
  useEffect(() => {
    if (!pp.enabled || firedRef.current) return;
    if (positions.length === 0) return;

    const mtm = positions.reduce((s, p) => s + p.pnl, 0);

    // Target hit → exit all
    if (mtm >= pp.mtmTarget) {
      firedRef.current = true;
      handleExitAll();
      return;
    }

    // Update trailing SL if trailing is enabled
    if (pp.trailingEnabled) {
      const steps = Math.floor((mtm - lastStepRef.current) / pp.increaseBy);
      if (steps > 0) {
        lastStepRef.current += steps * pp.increaseBy;
        trailSlRef.current += steps * pp.trailBy;
        setCurrentSl(trailSlRef.current);
      }
    }

    // SL hit → exit all
    if (mtm <= trailSlRef.current) {
      firedRef.current = true;
      handleExitAll();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  const handleExitAll = async () => {
    setActing("all");
    try {
      await exitAllPositions();
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(null);
    }
  };

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartHeight.current = ordersHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (dragStartY.current === null) return;
      const delta = dragStartY.current - ev.clientY;
      const next = Math.max(MIN_HEIGHT, dragStartHeight.current + delta);
      setOrdersHeight(next);
      setOrdersExpanded(next > MIN_HEIGHT);
    };

    const onMouseUp = () => {
      dragStartY.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [ordersHeight]);

  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);

  return (
    <div className="relative flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">
      {/* Stats bar */}
      <StatsBar
        positions={positions}
        isLive={isLive}
        loading={loading}
        acting={acting}
        onRefresh={load}
        onExitAll={handleExitAll}
        onOpenProfitProtection={() => setPpOpen(true)}
        ppTarget={pp.enabled ? pp.mtmTarget : null}
        ppCurrentSl={pp.enabled ? currentSl : null}
        ppTrailing={pp.enabled && pp.trailingEnabled}
      />

      {/* Positions — flex-1, scrollable */}
      <div className="flex-1 overflow-hidden" style={{ paddingBottom: ordersHeight }}>
        <PositionsPanel
          positions={positions}
          setPositions={setPositions}
          loading={loading}
          isLive={isLive}
          load={load}
        />
      </div>

      {/* Orders — pinned bottom, resizable */}
      <div
        className="absolute bottom-0 left-0 right-0 border-t border-border bg-background"
        style={{ height: ordersHeight }}
      >
        <div
          className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
          onMouseDown={onDragStart}
          title="Drag to resize"
        />
        <OrdersPanel
          expanded={ordersExpanded}
          onToggle={handleOrdersToggle}
          onRegisterRefresh={(fn) => { loadOrdersRef.current = fn; }}
        />
      </div>

      {/* Profit Protection config dialog */}
      <ProfitProtectionPanel
        open={ppOpen}
        onClose={() => setPpOpen(false)}
        currentMtm={totalPnl}
      />
    </div>
  );
}
