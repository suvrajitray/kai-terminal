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
  clearBasket: () => void;
}

export const useBasketStore = create<BasketStore>()((set, get) => ({
  items: [],
  addItem: (item) => {
    if (get().items.length >= MAX_BASKET_SIZE) {
      toast.error("Basket is full (max 20 items)");
      return;
    }
    set((s) => ({ items: [...s.items, { ...item, id: crypto.randomUUID() }] }));
    toast.success("Added to basket");
  },
  removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  updateItem: (id, patch) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
  clearBasket: () => set({ items: [] }),
}));
