import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { PositionsPanel } from "@/components/panels/positions-panel";
import { OrdersPanel } from "@/components/panels/orders-panel";
import { StatsBar } from "@/components/terminal/stats-bar";
import { ProfitProtectionPanel } from "@/components/terminal/profit-protection-panel";
import { BrokerAuthRequired } from "@/components/terminal/broker-auth-required";
import { usePositionsFeed } from "@/components/panels/positions-panel/use-positions-feed";
import { useProfitProtection } from "./use-profit-protection";
import { useRiskConfig } from "@/hooks/use-risk-config";
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

  // Hooks must be called unconditionally — one set per known broker in BROKERS.
  // When adding a new broker (e.g. "dhan"), add useRiskConfig, useProfitProtection,
  // getConfig, and one entry in ppBrokers below.
  useRiskConfig("upstox");
  useRiskConfig("zerodha");
  useRiskConfig("dhan");
  const { currentSl: upstoxSl }  = useProfitProtection(positions, "upstox");
  const { currentSl: zerodhasl } = useProfitProtection(positions, "zerodha");
  const { currentSl: dhanSl }    = useProfitProtection(positions, "dhan");
  const upstoxPp  = useProfitProtectionStore((s) => s.getConfig("upstox"));
  const zerodhaP  = useProfitProtectionStore((s) => s.getConfig("zerodha"));
  const dhanPp    = useProfitProtectionStore((s) => s.getConfig("dhan"));

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

  // Per-broker MTM — positions are tagged with broker field; untagged positions fall under "upstox"
  const mtmByBroker = positions.reduce<Record<string, number>>((acc, p) => {
    const key = p.broker ?? "upstox";
    acc[key] = (acc[key] ?? 0) + p.pnl;
    return acc;
  }, {});

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
        mtmByBroker={mtmByBroker}
        ppBrokers={[
          upstoxPp.enabled ? { broker: "upstox",  target: upstoxPp.mtmTarget, currentSl: upstoxSl,  trailing: upstoxPp.trailingEnabled } : null,
          zerodhaP.enabled ? { broker: "zerodha", target: zerodhaP.mtmTarget, currentSl: zerodhasl, trailing: zerodhaP.trailingEnabled } : null,
          dhanPp.enabled   ? { broker: "dhan",    target: dhanPp.mtmTarget,   currentSl: dhanSl,    trailing: dhanPp.trailingEnabled }   : null,
        ].filter((x): x is NonNullable<typeof x> => x !== null)}
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
        mtmByBroker={mtmByBroker}
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
