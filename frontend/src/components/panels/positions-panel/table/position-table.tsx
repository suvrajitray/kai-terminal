import { memo } from "react";
import { LayoutList } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PositionRow } from "../position-row";
import { PositionStats } from "../stats/position-stats";
import type { QtyMode } from "../qty-input";
import type { Position } from "@/types";

const selKey = (p: Position) => `${p.instrumentToken}|${p.product}`;

interface PositionTableProps {
  openPositions: Position[];
  closedPositions: Position[];
  loading: boolean;
  newPositionKeys: Set<string>;
  qtys: Record<string, string>;
  qtyMode: QtyMode;
  acting: string | null;
  selected: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  selectedCount: number;
  showGreeks: boolean;
  netDelta: number | undefined;
  thetaPerDay: number;
  thetaEarnedToday: number;
  toggleSelectAll: () => void;
  toggleSelect: (p: Position) => void;
  onQtyChange: (token: string, val: string) => void;
  onToggleMode: () => void;
  onAdd: (token: string, tradingSymbol: string, product: string, broker: string, exchange: string) => void;
  onReduce: (token: string, tradingSymbol: string, product: string, broker: string, exchange: string) => void;
  onShiftUp: (token: string, tradingSymbol: string, product: string, broker: string, exchange: string) => void;
  onShiftDown: (token: string, tradingSymbol: string, product: string, broker: string, exchange: string) => void;
  onExitSelected: () => void;
  onExitByType: (type: "CE" | "PE") => () => void;
}

export const PositionTable = memo(function PositionTable({
  openPositions,
  closedPositions,
  loading,
  newPositionKeys,
  qtys,
  qtyMode,
  acting,
  selected,
  allSelected,
  someSelected,
  selectedCount,
  showGreeks,
  netDelta,
  thetaPerDay,
  thetaEarnedToday,
  toggleSelectAll,
  toggleSelect,
  onQtyChange,
  onToggleMode,
  onAdd,
  onReduce,
  onShiftUp,
  onShiftDown,
  onExitSelected,
  onExitByType,
}: PositionTableProps) {
  const renderRow = (p: Position) => (
    <PositionRow
      key={p.instrumentToken + p.product}
      position={p}
      isNew={newPositionKeys.has(p.instrumentToken + p.product)}
      qtyValue={qtys[p.instrumentToken] ?? ""}
      qtyMode={qtyMode}
      acting={acting}
      selected={selected.has(selKey(p))}
      onToggleSelect={() => toggleSelect(p)}
      onQtyChange={(v) => onQtyChange(p.instrumentToken, v)}
      onToggleMode={onToggleMode}
      onAdd={() => onAdd(p.instrumentToken, p.tradingSymbol, p.product, p.broker ?? "upstox", p.exchange)}
      onReduce={() => onReduce(p.instrumentToken, p.tradingSymbol, p.product, p.broker ?? "upstox", p.exchange)}
      onShiftUp={() => onShiftUp(p.instrumentToken, p.tradingSymbol, p.product, p.broker ?? "upstox", p.exchange ?? "")}
      onShiftDown={() => onShiftDown(p.instrumentToken, p.tradingSymbol, p.product, p.broker ?? "upstox", p.exchange ?? "")}
    />
  );

  if (loading && openPositions.length === 0 && closedPositions.length === 0) {
    return (
      <table className="w-full text-xs">
        <tbody>
          {[0, 1, 2, 3, 4].map((i) => (
            <tr key={i} className="border-b border-border/30">
              <td className="px-3 py-2"><Skeleton className="h-3.5 w-3.5" /></td>
              <td className="px-3 py-2">
                <Skeleton className="mb-1 h-3.5 w-28" />
                <Skeleton className="h-2.5 w-20" />
              </td>
              <td className="px-3 py-2"><Skeleton className="h-3.5 w-14" /></td>
              <td className="px-3 py-2"><Skeleton className="h-3.5 w-8" /></td>
              <td className="px-3 py-2"><Skeleton className="h-3.5 w-14" /></td>
              <td className="px-3 py-2"><Skeleton className="h-3.5 w-14" /></td>
              <td className="px-3 py-2"><Skeleton className="h-3.5 w-16" /></td>
              <td className="px-3 py-2"><Skeleton className="h-3.5 w-14" /></td>
              <td className="px-3 py-2"><Skeleton className="ml-auto h-3.5 w-20" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (openPositions.length === 0 && closedPositions.length === 0) {
    return <EmptyState icon={LayoutList} message="No positions" />;
  }

  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 z-10 bg-muted/20 backdrop-blur-sm">
        <PositionStats
          allSelected={allSelected}
          someSelected={someSelected}
          toggleSelectAll={toggleSelectAll}
          selectedCount={selectedCount}
          acting={acting}
          onExitSelected={onExitSelected}
          onExitByType={onExitByType}
          showGreeks={showGreeks}
          netDelta={netDelta}
          thetaPerDay={thetaPerDay}
          thetaEarnedToday={thetaEarnedToday}
        />
      </thead>
      <tbody>
        {openPositions.map(renderRow)}
        {closedPositions.length > 0 && openPositions.length > 0 && (
          <tr>
            <td colSpan={11} className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 bg-muted/20">
              Closed
            </td>
          </tr>
        )}
        {closedPositions.map(renderRow)}
      </tbody>
    </table>
  );
});
