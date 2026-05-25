import { useState, useCallback, useMemo } from "react";
import { useBasketStore } from "@/stores/basket-store";

export function useBasketSelection() {
  const items      = useBasketStore((s) => s.items);
  const removeItem = useBasketStore((s) => s.removeItem);
  const clearBasket = useBasketStore((s) => s.clearBasket);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allSelected   = items.length > 0 && items.every((i) => selectedIds.has(i.id));
  const someSelected  = items.some((i) => selectedIds.has(i.id));
  const selectedCount = useMemo(() => items.filter((i) => selectedIds.has(i.id)).length, [items, selectedIds]);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  }, [allSelected, items]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const removeSelected = useCallback(() => {
    selectedIds.forEach((id) => removeItem(id));
    setSelectedIds(new Set());
  }, [selectedIds, removeItem]);

  const handleClearBasket = useCallback(() => {
    clearBasket();
    setSelectedIds(new Set());
  }, [clearBasket]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  return {
    selectedIds,
    allSelected,
    someSelected,
    selectedCount,
    toggleSelectAll,
    toggleSelect,
    removeSelected,
    handleClearBasket,
    clearSelection,
  };
}
