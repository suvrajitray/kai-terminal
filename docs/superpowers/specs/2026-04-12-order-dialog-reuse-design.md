# Order Dialog Reuse — Design Spec

**Date:** 2026-04-12  
**Status:** Approved

---

## Goal

Reuse `OptionChainOrderDialog` for the "Buy More", "Sell More", and "Exit" actions triggered from a position row, replacing the separate `SellBuyMoreDialog` and `ExitPositionDialog` components.

---

## Current State

Two separate dialog systems exist:

| Dialog | Location | Features |
|---|---|---|
| `OptionChainOrderDialog` | `option-chain-panel/option-chain-order-dialog.tsx` | Broker routing toggle, direction toggle, product picker (Intraday/Delivery), margin estimate (Required + Available) |
| `SellBuyMoreDialog` | `positions-panel/position-action-dialogs.tsx` | No broker routing, no product picker, no margin estimate |
| `ExitPositionDialog` | `positions-panel/position-action-dialogs.tsx` | No broker routing, no product picker, no margin estimate. Calls `onConfirm` callback instead of placing order directly |

`ConvertPositionDialog` and `AddStoplossDialog` are **not** affected — they remain unchanged.

---

## Design

### Approach: Extend `OptionChainOrderDialog` with lock props (Approach A)

Add three optional props to `OptionChainOrderDialog`:

```ts
interface Props {
  intent: OrderIntent | null;
  currentLtp?: number;
  onClose: () => void;
  // New optional props for position-row usage:
  lockedBroker?: string;            // hides broker routing toggle, uses this broker
  lockedProduct?: "Intraday" | "Delivery";  // hides product radio buttons
  hideDirectionToggle?: boolean;    // hides the Buy/Sell direction toggle
}
```

When `lockedBroker` and `lockedProduct` are set, replace the broker toggle + product radio buttons with a single read-only pill:

```
Product  [ Intraday · MIS ]  via Upstox
```

When `hideDirectionToggle` is true, remove the toggle button from the header.

---

### OrderIntent construction from Position

In `position-row.tsx`, construct an `OrderIntent` from the position before opening the dialog. Use the contracts store for strike/underlying/side; fall back to `parseTradingSymbol` (already in `position-action-dialogs.tsx`, to be moved to a shared util) for positions not in the store.

```ts
function buildOrderIntent(
  position: Position,
  transactionType: "Buy" | "Sell",
  getByInstrumentKey: (token: string, symbol?: string) => { contract, index } | undefined,
): OrderIntent {
  const lookup = getByInstrumentKey(position.instrumentToken, position.tradingSymbol);
  const contract = lookup?.contract;
  const index = lookup?.index;
  const parsed = contract ? null : parseTradingSymbol(position.tradingSymbol);

  return {
    instrumentKey: position.instrumentToken,
    side: (contract?.instrumentType ?? parsed?.type ?? "CE") as "CE" | "PE",
    transactionType,
    ltp: position.ltp,
    strike: contract?.strikePrice ?? Number(parsed?.strike ?? 0),
    underlying: index ?? parsed?.index ?? position.tradingSymbol,
  };
}
```

---

### Action → dialog configuration mapping

| Action | `transactionType` | `defaultQty` | `lockedBroker` | `lockedProduct` | `hideDirectionToggle` |
|---|---|---|---|---|---|
| Buy More | `"Buy"` | 1 lot | `position.broker` | `position.product` | `true` |
| Sell More | `"Sell"` | 1 lot | `position.broker` | `position.product` | `true` |
| Exit | opposite of position direction¹ | `Math.abs(position.quantity)` in qty mode | `position.broker` | `position.product` | `true` |

¹ Short position (`quantity < 0`) → `"Buy"` to exit. Long position (`quantity > 0`) → `"Sell"` to exit.

---

### Default quantity initialisation

`OptionChainOrderDialog` currently initialises `qtyValue` to `"1"` in `lot` mode. A new optional prop `defaultQtyOverride?: { value: number; mode: "qty" | "lot" }` controls the initial value:

- Buy More / Sell More: no override (defaults to 1 lot as today)
- Exit: `{ value: Math.abs(position.quantity), mode: "qty" }` — prefills the full position quantity in qty mode

---

### Order placement for Exit

**Behaviour change:** Today, `ExitPositionDialog` calls `onConfirm` → `handleExit` → `exitPosition()` — a dedicated server-side full-position exit endpoint. The qty and limit-price inputs the dialog collects are never used (they're passed to `onConfirm()` which ignores them). This is effectively a bug.

The unified dialog fixes this: it calls `placeOrder(token, qty, direction, product, orderType, price, broker)` directly, honouring the user's chosen qty and order type. Direction is the opposite of the position direction (short → Buy, long → Sell).

The `onConfirm` callback on `ExitPositionDialog` is dropped entirely. The `onExit` prop on `PositionRow` — which was only wired to `ExitPositionDialog.onConfirm` — is removed from `PositionRowProps` and its call site in `positions-panel/index.tsx`.

> Note: the inline quick-exit buttons (+ / − on the row) and the bulk "Exit selected" / "Exit CEs/PEs" toolbar actions all continue to use `exitPosition` — they are unaffected by this change.

---

### Product display in locked mode

When `lockedProduct` is set, replace the product radio group with a single locked indicator row:

```tsx
{lockedProduct ? (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
    <span>Product</span>
    <span className="rounded bg-muted/30 border border-border/40 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
      {lockedProduct} · {lockedProduct === "Intraday" ? "MIS" : "NRML"}
    </span>
    <span className="text-muted-foreground/50">via {broker}</span>
  </div>
) : (
  /* existing product radio group */
)}
```

---

## Files changed

| File | Change |
|---|---|
| `option-chain-panel/option-chain-order-dialog.tsx` | Add `lockedBroker`, `lockedProduct`, `hideDirectionToggle`, `defaultQtyOverride` props; conditional rendering |
| `positions-panel/position-row.tsx` | Replace `SellBuyMoreDialog` + `ExitPositionDialog` with `OptionChainOrderDialog`; add `buildOrderIntent` helper; remove `onExit` prop |
| `positions-panel/position-action-dialogs.tsx` | Remove `SellBuyMoreDialog` and `ExitPositionDialog` exports; extract `parseTradingSymbol` to a shared location or keep as internal util used by `position-row.tsx` |
| `positions-panel/index.tsx` | Remove `onExit` prop passed to `PositionRow` and the handler that built it |

`ConvertPositionDialog`, `AddStoplossDialog`, `PositionActions` — untouched.

---

## Out of scope

- Stoploss dialog reuse
- Convert position dialog reuse
- Margin estimate for `AddStoplossDialog`
