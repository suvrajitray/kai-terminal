# Basket Feature — Design Spec

**Date:** 2026-05-08  
**Status:** Approved

---

## Overview

A session-only basket that lets users queue multiple orders from the positions panel and option chain, then place them all at once. No search-and-add. No backend integration in this phase — UI only.

---

## Data Model

```typescript
// stores/basket-store.ts
interface BasketItem {
  id: string;                        // crypto.randomUUID()
  instrumentKey: string;             // Upstox token (e.g. "NSE_FO|37590")
  displayName: string;               // "NIFTY 24000 PE"
  exchange: string;                  // "NFO"
  side: "CE" | "PE";
  underlying: string;                // "NIFTY"
  strike: number;
  expiry?: string;                   // "2025-05-22"
  ltp: number;
  lotSize: number;
  transactionType: "Buy" | "Sell";
  orderType: "Market" | "Limit";
  product: "Intraday" | "Delivery";
  qty: number;                       // in lots
  limitPrice: string;                // relevant only when orderType = "Limit"
}

interface BasketStore {
  items: BasketItem[];
  addItem: (item: Omit<BasketItem, "id">) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<BasketItem>) => void;
  clearBasket: () => void;
}
```

**Defaults on add:** `orderType = "Market"`, `product = "Intraday"`, `qty = 1`.  
`transactionType` defaults depend on source (see Entry Points below).  
Not persisted — Zustand in-memory only, resets on page reload.

---

## Entry Points

### 1. Position row → dropdown (`...` menu)

New menu item **"Add to basket"** (ShoppingCart icon) added to the existing `MoreHorizontal` dropdown in `position-actions.tsx`.

- `transactionType` defaults: short position (`quantity < 0`) → **Buy**; long position (`quantity > 0`) → **Sell**
- `displayName` built from existing contract lookup (same logic as position row rendering)
- `ltp` taken from `position.ltp`
- `lotSize` from `getLotSize(position.tradingSymbol)`
- Fires a toast: *"Added to basket"*

Changes: `position-actions.tsx` (new prop `onAddToBasket`), `position-row.tsx` (wire action).

### 2. Option chain → basket mode toggle

A cart icon button added to the option chain panel header (`panel-header.tsx`), alongside the existing Refresh and Close buttons.

- Clicking toggles `basketMode: boolean` — local state in `option-chain-panel/index.tsx`
- When active: icon turns blue (same style as the chain header basket button mockup)
- `basketMode` is passed down to `OptionChainRow` as a prop
- In basket mode, the existing hover B/S buttons call `onAddToBasket(intent)` instead of `onOrder(intent)`
- `transactionType` is taken from the button pressed: B button → **Buy**, S button → **Sell** (matches the intent already carried by `triggerOrder`)

Changes: `panel-header.tsx` (new `basketMode` + `onBasketModeToggle` props), `option-chain-panel/index.tsx` (manage `basketMode` state, pass to rows), `option-chain-row.tsx` (new `basketMode` + `onAddToBasket` props).

---

## Components

### `stores/basket-store.ts` *(new)*
Zustand store. Max 20 items (same as Zerodha). `addItem` is a no-op and shows a toast if at capacity.

### `components/layout/basket-button.tsx` *(new)*
Header icon button. Shows `ShoppingCart` icon from lucide-react. Renders a blue badge with item count when `items.length > 0`. Hidden when basket is empty (no badge, icon still visible but muted). Clicking opens `BasketDialog`.

Placed in `header.tsx` right after `QuickTradeButton`, only when `brokerAuthenticated`.

### `components/layout/basket-dialog/index.tsx` *(new)*
Full-screen-overlay Dialog (shadcn `Dialog`). Width ~760px.

**Header:** Cart icon + "Basket" title + item count label + "Clear basket" button (hidden when empty).

**Table columns:** checkbox | B/S toggle | Instrument (name + exchange/expiry meta) | LTP | Order type pill | Product pill | Qty (lots) input | Price input | Remove button

**B/S toggle:** Pill button. Red background (`bg-red-900/50 text-red-300`) for Sell, green (`bg-green-900/50 text-green-300`) for Buy. Clicking toggles `transactionType` on that item.

**Order type pill:** Two-segment pill — `Market | Limit`. Switching to Limit enables the Price input for that row; switching back to Market sets price to `""` and shows `—`.

**Product pill:** Two-segment pill — `Intraday | Delivery`.

**Qty input:** Small numeric input, tabular-nums, right-aligned, editable.

**Price input:** Shown (editable) when `orderType = "Limit"`, replaced by `—` (muted) when `"Market"`.

**Footer:** Right-aligned. "Close" ghost button + "Place all" primary blue button (disabled + loading spinner while placing; placeholder for now since backend integration is out of scope).

### `components/layout/basket-dialog/basket-item-row.tsx` *(new)*
Single row component. Receives item + `onUpdate(patch)` + `onRemove()`. All interactions are local updates dispatched to the store via `onUpdate`.

---

## Touch Points in Existing Files

| File | Change |
|------|--------|
| `header.tsx` | Add `<BasketButton />` after `<QuickTradeButton />` |
| `position-actions.tsx` | Add `onAddToBasket?: () => void` prop; new dropdown item |
| `position-row.tsx` | Build basket item from position data; call `useBasketStore.addItem` |
| `option-chain-panel/index.tsx` | Add `basketMode` state; pass to header + rows; handle `onAddToBasket` |
| `option-chain-panel/panel-header.tsx` | Add basket mode toggle button |
| `option-chain-panel/option-chain-row.tsx` | Accept `basketMode` + `onAddToBasket`; conditionally call on B/S button click |

---

## Out of Scope (this phase)

- "Place all" backend integration
- Margin calculation per basket item
- Broker routing per item (will use session default)
- Persisting basket across reloads
