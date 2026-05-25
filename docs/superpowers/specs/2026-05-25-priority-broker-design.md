# Priority Broker Design

**Date:** 2026-05-25  
**Status:** Approved

---

## Problem

When multiple brokers are connected, the order dialog always defaults to Upstox because active brokers are filtered from a static `BROKERS` array where Upstox is always index 0. The user has no way to control which broker is pre-selected when opening an order.

---

## Approach

Store a `brokerPriority: string[]` array (persisted to `localStorage`) in the broker store. When deriving the list of active brokers for the order dialog, sort by this array so the priority broker is always index 0. "Set as default" in the broker chip popover moves a broker to index 0 of that array.

This fixes both the default selection and the display order of the "Route via" toggle inside the order dialog in a single place.

---

## Data Model

**`broker-store.ts`** — add to `BrokerState`:
```ts
brokerPriority: string[];          // persisted, default []
setDefaultBroker: (id: string) => void;
```

`setDefaultBroker(id)` moves `id` to position 0 of `brokerPriority`, preserving other entries.

Empty array means "use BROKERS static order" (backwards-compatible — no migration needed).

---

## Components

### `broker-store.ts`
- Add `brokerPriority: string[]` to state (persisted, initial value `[]`).
- Add `setDefaultBroker(id)` action: filters out `id` then prepends it.

### `order-dialog.tsx`
- Read `brokerPriority` from broker store.
- Sort `activeBrokers` by priority order before taking `activeBrokers[0]` as the default.
- The "Route via" toggle renders brokers in this sorted order, so the default is shown first.

### `broker-status-chips.tsx`
- Read `brokerPriority[0]` as the current default broker id.
- **Chip:** show a `★` prefix on the chip label when it is the default and multiple brokers are connected.
- **Popover:** add a "Set as default" button (only rendered when ≥ 2 brokers are connected and this broker is not already the default).

---

## Behaviour

| Scenario | Result |
|----------|--------|
| Single broker connected | That broker is the default (no change, no UI shown) |
| Multiple connected, no priority set | First in static BROKERS order (Upstox) — same as today |
| Multiple connected, priority set | Priority broker pre-selected in order dialog and shown first in Route-via toggle |
| Priority broker loses its token (expired/disconnected) | Falls back to next active broker in priority order |
| All brokers disconnected | Existing "upstox" string fallback in `getOrderDialogDefaults` unchanged |

---

## Scope

- Affects: `broker-store.ts`, `order-dialog.tsx`, `broker-status-chips.tsx`
- Does **not** affect: positions panel, risk config, PP store, backend
- The quick-trade chain dialog receives `broker` as a prop from its parent — out of scope for this change

---

## No-Backend Changes

This is entirely frontend state persisted in `localStorage` via Zustand `persist`. No API or DB changes.
