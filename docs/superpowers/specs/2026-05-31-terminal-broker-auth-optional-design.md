# Terminal: make broker authentication optional

**Date:** 2026-05-31
**Status:** Approved design
**Area:** `frontend/src` — terminal page

## Problem

The terminal page is fully gated behind broker authentication. In
`pages/terminal-page.tsx`, if no valid broker token exists, the entire page is
replaced by `components/terminal/broker-auth-required.tsx` (a full-screen
"Connect Broker" prompt).

But most of the terminal is broker-agnostic. Only **placing orders** and
**reading positions/orders** require a broker token. Everything analytical
(option chain, Greeks, indices, IV, analytics) works with just the app JWT.
Blocking the whole page needlessly hides ~60% of the terminal from users who
are logged in but have not connected a broker.

## Goal

When the user is logged in but has no valid broker token, show the
broker-agnostic terminal (option chain, indices, analytics) and gate only the
three broker-dependent surfaces, each with an inline prompt to connect a broker.

## What requires a broker token (verified)

| Surface | Endpoint / mechanism | Needs broker? |
|---------|----------------------|---------------|
| Option chain + Greeks | `GET /api/masterdata/options/chain` | No |
| Master contracts, IV history | `/api/masterdata/*` | No |
| Index ticker / spot | `/hubs/indices` (no token in URL) | No |
| Option chain LTP stream | `/hubs/option-chain` (no token) | No |
| Analytics (max pain, PCR, IV rank, payoff) | derived client-side | No |
| Positions | `/api/upstox|zerodha/positions` | **Yes** |
| Orders panel | `/api/upstox/orders` | **Yes** |
| Order entry from chain | `option-chain-row.tsx triggerOrder` → ticket / basket | **Yes** |
| Exit-all / exit / convert, Profit Protection | broker endpoints | **Yes** |

The positions feed already no-ops safely without a broker token:
`use-signalr-positions.tsx` returns early when no broker is present, and
`use-positions-rest-fallback.ts` returns empty arrays per-broker. So mounting
the inner terminal with no broker produces no errors and no stray requests.

## Design

### Core change — `pages/terminal-page.tsx`

- Remove the full-page gate (the `if (!hasValid) return <BrokerAuthRequired …>`
  early return).
- Always render `TerminalPageInner`.
- Compute `hasValidBroker` (at least one non-expired broker token, using the
  existing `isBrokerTokenExpired` check) inside `TerminalPageInner` and thread
  it to the three surfaces below.
- `components/terminal/broker-auth-required.tsx` is no longer used as a
  full-page gate. It may be removed or repurposed as the inline empty-state
  component (see Positions pane).

### 1. Positions pane

When `!hasValidBroker`, replace the positions **table** with a centered inline
empty-state inside the pane:

- Icon + heading "Connect a broker to see positions & trade"
- A "Connect Broker" link/button → navigates to `/connect-brokers`
- Reuses the visual language of the current `BrokerAuthRequired` card, but
  rendered inline within the positions pane (not full-screen).

The pane container, header, and surrounding layout stay intact.

### 2. Stats bar + orders panel

When `!hasValidBroker`:

- Hide the broker-action buttons in the stats bar: **Exit All** and **Profit
  Protection**. Chain toggle and pure-display elements remain.
- Hide the orders panel (the resizable bottom strip) entirely, so the positions
  empty-state fills the left column. Set `ordersHeight` to 0 / skip rendering
  the orders strip when `!hasValidBroker`.

### 3. Option chain order entry

The chain stays fully live and interactive for viewing regardless of broker
state. Order placement is intercepted when `!hasValidBroker`:

- In `option-chain-row.tsx` `triggerOrder` (row Buy/Sell) and the basket
  **execute** action, check `hasValidBroker` first.
- If false, show an **actionable toast**: "Connect a broker to place orders"
  with a link/action to `/connect-brokers`, and return early (do not open the
  order ticket or execute the basket).
- Buy/Sell buttons stay visually enabled so the chain does not feel inert.
- `hasValidBroker` is read at the click site from `useBrokerStore` (avoids deep
  prop drilling through the chain subtree).

### Data flow

- `hasValidBroker` derived once from `useBrokerStore` via `isBrokerTokenExpired`.
- Passed as a prop to `PositionsPanel` and `StatsBar`.
- For the chain order-entry intercept, read from `useBrokerStore` directly at
  the click handlers rather than prop-drilling.

## Out of scope / untouched

- Option chain data + feed, indices feed, IV history, analytics, payoff chart —
  already broker-agnostic, no change.
- Backend — no changes; all gating is client-side.
- Partial auth (e.g. Upstox valid, Zerodha expired) is unchanged:
  `hasValidBroker` is true and existing per-broker logic inside the feeds
  handles it as today.

## Decisions

- Chain order-entry intercept uses an **actionable toast** (lighter,
  non-blocking; toast system already exists), not a modal dialog.
- Option chain panel keeps its current default open state (already open) — no
  auto-open behavior change.

## Testing

No frontend test project exists in this repo, so verification is manual:

1. Logged in, **no broker connected**: terminal renders; option chain +
   indices + analytics live; positions pane shows connect prompt; Exit All /
   Profit Protection hidden; orders strip hidden; clicking a chain Buy/Sell
   shows the connect toast.
2. **Broker connected** (valid token): terminal behaves exactly as before —
   positions, orders, stats actions, and order entry all functional.
3. **Token expired** (had broker, now expired): same as case 1 (treated as no
   valid broker).
4. **Partial auth** (one valid, one expired): behaves as today — trades and
   positions work for the valid broker.
