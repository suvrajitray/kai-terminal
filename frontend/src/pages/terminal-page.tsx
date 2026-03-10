import { useState, useRef, useCallback, useEffect } from "react";
import { PositionsPanel } from "@/components/panels/positions-panel";
import { OrdersPanel } from "@/components/panels/orders-panel";
import { StatsBar } from "@/components/terminal/stats-bar";
import { ProfitProtectionPanel } from "@/components/terminal/profit-protection-panel";
import { usePositionsFeed } from "@/components/panels/positions-panel/use-positions-feed";
import { exitAllPositions } from "@/services/trading-api";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";

const DEFAULT_ORDERS_HEIGHT = 180;
const MIN_HEIGHT = 32;

export function TerminalPage() {
  const { positions, setPositions, loading, isLive, load } = usePositionsFeed();
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [ordersHeight, setOrdersHeight] = useState(DEFAULT_ORDERS_HEIGHT);
  const [ppOpen, setPpOpen] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef<number>(DEFAULT_ORDERS_HEIGHT);

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
    setError(null);
    try {
      await exitAllPositions();
      await load();
    } catch (e) {
      setError((e as Error).message);
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
      setOrdersHeight(Math.max(MIN_HEIGHT, dragStartHeight.current + delta));
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
        error={error}
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
        <OrdersPanel />
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
