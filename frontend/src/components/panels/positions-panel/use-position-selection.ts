import { useCallback, useMemo, useState } from "react";
import type { Position } from "@/types";
import { selectionKey } from "./position-keys";

export function usePositionSelection(openPositions: Position[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allOpenKeys = useMemo(
    () => openPositions.map(selectionKey),
    [openPositions],
  );
  const allSelected = allOpenKeys.length > 0 && allOpenKeys.every((key) => selected.has(key));
  const someSelected = allOpenKeys.some((key) => selected.has(key));
  const selectedCount = allOpenKeys.filter((key) => selected.has(key)).length;

  const toggleSelectAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(allOpenKeys));
  }, [allOpenKeys, allSelected]);

  const toggleSelect = useCallback((position: Position) => {
    if (position.quantity === 0) return;

    const key = selectionKey(position);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearSelected = useCallback(() => {
    setSelected(new Set());
  }, []);

  return {
    selected,
    allSelected,
    someSelected,
    selectedCount,
    toggleSelectAll,
    toggleSelect,
    clearSelected,
  };
}

