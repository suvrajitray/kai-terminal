import { create } from "zustand";
import { toast } from "@/lib/toast";

export interface BasketItem {
  id: string;
  instrumentKey: string;
  displayName: string;
  exchange: string;
  side: "CE" | "PE";
  underlying: string;
  strike: number;
  expiry?: string;
  ltp: number;
  lotSize: number;
  transactionType: "Buy" | "Sell";
  orderType: "Market" | "Limit";
  product: "Intraday" | "Delivery";
  qty: number;       // in lots — multiply by lotSize to get contract quantity for order placement
  limitPrice: string;
}

const MAX_BASKET_SIZE = 20;

interface BasketStore {
  items: BasketItem[];
  addItem: (item: Omit<BasketItem, "id">) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<BasketItem>) => void;
  updateLtpBatch: (updates: Array<{ instrumentToken: string; ltp: number }>) => void;
  clearBasket: () => void;
}

export const useBasketStore = create<BasketStore>()((set, get) => ({
  items: [],
  addItem: (item) => {
    const items = get().items;
    if (items.length >= MAX_BASKET_SIZE) {
      toast.error("Basket is full (max 20 items)");
      return;
    }
    if (items.some((i) => i.instrumentKey === item.instrumentKey)) return;
    set((s) => ({ items: [...s.items, { ...item, id: crypto.randomUUID() }] }));
  },
  removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  updateItem: (id, patch) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
  updateLtpBatch: (updates) => {
    const map = new Map(updates.map((u) => [u.instrumentToken, u.ltp]));
    set((s) => {
      if (s.items.length === 0 || map.size === 0) return s;
      let changed = false;
      const next = s.items.map((item) => {
        const ltp = map.get(item.instrumentKey);
        if (ltp === undefined || ltp === item.ltp) return item;
        changed = true;
        return { ...item, ltp };
      });
      return changed ? { items: next } : s;
    });
  },
  clearBasket: () => set({ items: [] }),
}));
