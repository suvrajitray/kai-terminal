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
  const [exitAllConfirmOpen, setExitAllConfirmOpen] = useState(false);
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
  const latestMtmRef = useRef<number>(0);             // always tracks the latest open-positions MTM
  const [currentSl, setCurrentSl] = useState<number>(pp.mtmSl); // reactive copy for display

  // Full reset only when PP is toggled on — config edits must NOT reset trailing progress.
  // Seed lastStepRef from latestMtmRef so we never retroactively "catch up" steps from 0,
  // which would push the trailing stop above the current MTM and fire spuriously.
  useEffect(() => {
    if (!pp.enabled) return;
    trailSlRef.current = pp.mtmSl;
    lastStepRef.current = latestMtmRef.current;   // start from current MTM, not 0
    firedRef.current = false;
    setCurrentSl(pp.mtmSl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pp.enabled]);

  // When mtmSl is tightened while PP is already running, raise the floor — but never lower it
  // (lowering would drop a trailing stop that was already raised, which would be wrong)
  useEffect(() => {
    if (!pp.enabled) return;
    if (pp.mtmSl > trailSlRef.current) {
      trailSlRef.current = pp.mtmSl;
      setCurrentSl(pp.mtmSl);
    }
  }, [pp.enabled, pp.mtmSl]);

  // Monitor MTM on every positions update
  useEffect(() => {
    if (!pp.enabled || firedRef.current) return;

    const openPositions = positions.filter((p) => p.quantity !== 0);
    if (openPositions.length === 0) return;

    const mtm = openPositions.reduce((s, p) => s + p.pnl, 0);
    latestMtmRef.current = mtm;   // keep latestMtmRef in sync for the reset effect

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

  // Keyboard shortcuts: R = refresh, E = exit all (with confirm)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "r" || e.key === "R") { e.preventDefault(); load(); }
      if (e.key === "e" || e.key === "E") {
        const openCount = positions.filter((p) => p.quantity !== 0).length;
        if (openCount > 0) { e.preventDefault(); setExitAllConfirmOpen(true); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [load, positions]);

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
        onExitAll={() => setExitAllConfirmOpen(true)}
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

      {/* Exit All confirmation (triggered by E key or button) */}
      <AlertDialog open={exitAllConfirmOpen} onOpenChange={setExitAllConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit all positions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will place market exit orders for all open positions. This action cannot be undone.
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
