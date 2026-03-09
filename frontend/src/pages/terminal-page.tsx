import { useState, useRef, useCallback } from "react";
import { PositionsPanel } from "@/components/panels/positions-panel";

const DEFAULT_HEIGHT = 220;
const MIN_HEIGHT = 32;
const COLLAPSED_HEIGHT = 32;

export function TerminalPage() {
  const [positionsExpanded, setPositionsExpanded] = useState(true);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef<number>(DEFAULT_HEIGHT);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartHeight.current = panelHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (dragStartY.current === null) return;
      const delta = dragStartY.current - ev.clientY;
      const next = Math.max(MIN_HEIGHT + 1, dragStartHeight.current + delta);
      setPanelHeight(next);
      if (next > COLLAPSED_HEIGHT) setPositionsExpanded(true);
    };

    const onMouseUp = () => {
      dragStartY.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [panelHeight]);

  const handleToggle = () => {
    setPositionsExpanded((v) => {
      if (!v) setPanelHeight(DEFAULT_HEIGHT);
      return !v;
    });
  };

  const height = positionsExpanded ? panelHeight : COLLAPSED_HEIGHT;

  return (
    <div className="relative flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">

      {/* ── Main workspace — empty for now ───────────────────────────────── */}
      <div
        className="flex-1 overflow-hidden"
        style={{ paddingBottom: height }}
      />

      {/* ── Positions — pinned to bottom ─────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 border-t border-border bg-background"
        style={{ height }}
      >
        {/* Drag handle */}
        <div
          className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
          onMouseDown={onDragStart}
          title="Drag to resize"
        />
        <PositionsPanel
          expanded={positionsExpanded}
          onToggle={handleToggle}
        />
      </div>
    </div>
  );
}
