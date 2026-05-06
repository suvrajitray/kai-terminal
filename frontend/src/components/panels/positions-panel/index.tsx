import { useNewRows } from "@/hooks/use-new-rows";
import { PositionFilters } from "./filters/position-filters";
import { rowKey } from "./position-keys";
import { PositionTable } from "./table/position-table";
import { usePositionActions } from "./use-position-actions";
import { usePositionFilters } from "./use-position-filters";
import { usePositionGreeksSummary } from "./use-position-greeks-summary";
import { usePositionQuantities } from "./use-position-quantities";
import { usePositionSelection } from "./use-position-selection";
import type { Position } from "@/types";

interface PositionsPanelProps {
  positions: Position[];
  loading: boolean;
  load: () => void;
  netDelta?: number;
  thetaPerDay?: number;
  productFilter: "Intraday" | "Delivery" | null;
  onProductFilterChange: (v: "Intraday" | "Delivery" | null) => void;
}

export function PositionsPanel({
  positions,
  loading,
  load,
  netDelta,
  thetaPerDay = 0,
  productFilter,
  onProductFilterChange,
}: PositionsPanelProps) {
  const newPositionKeys = useNewRows(positions, rowKey);
  const {
    qtys,
    qtyMode,
    setQty,
    toggleMode,
    resolveQty,
  } = usePositionQuantities(positions);
  const {
    brokerFilter,
    setBrokerFilter,
    brokersInPositions,
    filteredMtmByBroker,
    showBrokerFilter,
    showProductFilter,
    showFilter,
    openPositions,
    closedPositions,
  } = usePositionFilters(positions, productFilter);
  const {
    selected,
    allSelected,
    someSelected,
    selectedCount,
    toggleSelectAll,
    toggleSelect,
    clearSelected,
  } = usePositionSelection(openPositions);
  const {
    acting,
    handleAdd,
    handleReduce,
    handleShiftUp,
    handleShiftDown,
    handleExitSelected,
    handleExitByType,
  } = usePositionActions({
    positions,
    openPositions,
    selected,
    resolveQty,
    clearSelected,
    load,
  });
  const { thetaEarnedToday, showGreeks } = usePositionGreeksSummary({
    netDelta,
    thetaPerDay,
    openPositions,
  });

  return (
    <div className="flex h-full flex-col">
      {showFilter && (
        <PositionFilters
          brokerFilter={brokerFilter}
          setBrokerFilter={setBrokerFilter}
          productFilter={productFilter}
          onProductFilterChange={onProductFilterChange}
          brokersInPositions={brokersInPositions}
          filteredMtmByBroker={filteredMtmByBroker}
          showBrokerFilter={showBrokerFilter}
          showProductFilter={showProductFilter}
        />
      )}
      <div className="flex-1 overflow-auto">
        <PositionTable
          openPositions={openPositions}
          closedPositions={closedPositions}
          loading={loading}
          newPositionKeys={newPositionKeys}
          qtys={qtys}
          qtyMode={qtyMode}
          acting={acting}
          selected={selected}
          allSelected={allSelected}
          someSelected={someSelected}
          selectedCount={selectedCount}
          showGreeks={showGreeks}
          netDelta={netDelta}
          thetaPerDay={thetaPerDay}
          thetaEarnedToday={thetaEarnedToday}
          toggleSelectAll={toggleSelectAll}
          toggleSelect={toggleSelect}
          onQtyChange={setQty}
          onToggleMode={toggleMode}
          onAdd={handleAdd}
          onReduce={handleReduce}
          onShiftUp={handleShiftUp}
          onShiftDown={handleShiftDown}
          onExitSelected={handleExitSelected}
          onExitByType={handleExitByType}
        />
      </div>
    </div>
  );
}

