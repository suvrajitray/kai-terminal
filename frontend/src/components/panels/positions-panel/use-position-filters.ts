import { useMemo, useState } from "react";
import type { Position } from "@/types";

export function usePositionFilters(
  positions: Position[],
  productFilter: "Intraday" | "Delivery" | null,
) {
  const [brokerFilter, setBrokerFilter] = useState<string | null>(null);

  const brokersInPositions = useMemo(
    () => Array.from(new Set(positions.map((position) => position.broker ?? "upstox"))),
    [positions],
  );
  const productTypesInPositions = useMemo(
    () => Array.from(new Set(positions.map((position) => position.product))),
    [positions],
  );

  const showBrokerFilter = brokersInPositions.length > 1;
  const showProductFilter = productTypesInPositions.includes("Intraday") && productTypesInPositions.includes("Delivery");
  const showFilter = showBrokerFilter || showProductFilter;

  const filtered = useMemo(
    () => positions
      .filter((position) => !brokerFilter || (position.broker ?? "upstox") === brokerFilter)
      .filter((position) => !productFilter || position.product === productFilter),
    [brokerFilter, positions, productFilter],
  );

  const filteredMtmByBroker = useMemo(
    () => filtered.reduce<Record<string, number>>((acc, position) => {
      const key = position.broker ?? "upstox";
      acc[key] = (acc[key] ?? 0) + position.pnl;
      return acc;
    }, {}),
    [filtered],
  );

  const openPositions = useMemo(
    () => filtered.filter((position) => position.quantity !== 0),
    [filtered],
  );
  const closedPositions = useMemo(
    () => filtered.filter((position) => position.quantity === 0),
    [filtered],
  );

  return {
    brokerFilter,
    setBrokerFilter,
    brokersInPositions,
    filteredMtmByBroker,
    showBrokerFilter,
    showProductFilter,
    showFilter,
    openPositions,
    closedPositions,
  };
}

