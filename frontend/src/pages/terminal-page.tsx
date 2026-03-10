import { useState, useRef, useCallback } from "react";
import { PositionsPanel } from "@/components/panels/positions-panel";
import { OrdersPanel } from "@/components/panels/orders-panel";
import { StatsBar } from "@/components/terminal/stats-bar";
import { usePositionsFeed } from "@/components/panels/positions-panel/use-positions-feed";
import { exitAllPositions } from "@/services/trading-api";

const DEFAULT_ORDERS_HEIGHT = 180;
const MIN_HEIGHT = 32;

export function TerminalPage() {
  const { positions, setPositions, loading, isLive, load } = usePositionsFeed();
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [ordersHeight, setOrdersHeight] = useState(DEFAULT_ORDERS_HEIGHT);
  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef<number>(DEFAULT_ORDERS_HEIGHT);

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
        {/* Drag handle */}
        <div
          className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
          onMouseDown={onDragStart}
          title="Drag to resize"
        />
        <OrdersPanel />
      </div>
    </div>
  );
}
