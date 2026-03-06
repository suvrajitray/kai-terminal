import { useState } from "react";
import { PositionsPanel } from "@/components/panels/positions-panel";

const POSITIONS_HEIGHT = 220;

export function TerminalPage() {
  const [positionsExpanded, setPositionsExpanded] = useState(true);

  return (
    <div className="relative flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">

      {/* ── Main workspace — empty for now ───────────────────────────────── */}
      <div
        className="flex-1 overflow-hidden"
        style={{ paddingBottom: positionsExpanded ? POSITIONS_HEIGHT : 32 }}
      />

      {/* ── Positions — pinned to bottom ─────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 border-t border-border bg-background transition-all duration-200"
        style={{ height: positionsExpanded ? POSITIONS_HEIGHT : 32 }}
      >
        <PositionsPanel
          expanded={positionsExpanded}
          onToggle={() => setPositionsExpanded((v) => !v)}
        />
      </div>
    </div>
  );
}
