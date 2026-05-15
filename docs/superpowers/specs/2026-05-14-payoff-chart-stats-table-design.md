# Payoff Chart — Stats Bar + Payoff Table

**Date:** 2026-05-14  
**Scope:** `frontend/src/components/terminal/payoff-chart-dialog/`  
**Inspiration:** Sensibull / Zerodha payoff chart UI

---

## Summary

Two additive improvements to the existing P&L at Expiry dialog:

1. **Stats Bar** — always-visible summary row above the chart (Max Profit, Max Loss, At Spot P&L, breakeven prices with % from spot)
2. **Payoff Table Tab** — a "Chart | Table" tab switcher; the Table tab shows a price-ladder grid with per-expiry P&L columns

No backend changes. All data derived client-side from existing `payoffAt()` and `groupCurves`.

---

## Layout

```
┌─────────────────────────────────────────┐
│ Dialog header: "P&L at Expiry — NIFTY"  │
├───────────┬───────────┬─────────────────┤
│ Max Profit│  Max Loss │    At Spot      │  ← Stats bar (always visible)
├───────────┴───────────┴─────────────────┤
│ B/E  ₹74,143 −1.0%   ₹75,661 +1.1%    │  ← BE row (always visible)
├─────────────────────────────────────────┤
│  [Chart]  [Table]                       │  ← Tab bar
├─────────────────────────────────────────┤
│  <Chart content>  OR  <Table content>   │
└─────────────────────────────────────────┘
```

---

## Feature 1: Stats Bar

### Component: `stats-bar.tsx`

Props:
```ts
interface StatsBarProps {
  groups: ExpiryGroup[];
  groupCurves: { expiry: string; pts: [number, number][]; breakevens: number[]; color: string }[];
  spot: number;
  xMin: number;
  xMax: number;
}
```

### Stat computations (all from curve points)

**Max Profit:**
- Find `max(pts.map(p => p[1]))` across all groups combined.
- If the rightmost point's P&L is still higher than the second-rightmost (curve rising at right edge), show `"Unlimited"`.
- If the leftmost point's P&L is still higher than the second-leftmost (curve rising at left edge), also consider "Unlimited".
- Otherwise show `+₹XX,XXX` in green.

**Max Loss:**
- Find `min(pts.map(p => p[1]))` across all groups combined.
- If the curve is still falling at either edge, show `"Unlimited"` in red.
- Otherwise show `−₹XX,XXX` in red.

**At Spot:**
- `payoffAt(allLegs, spot)` — already computed in the chart. Green if ≥ 0, red if < 0.

### Breakeven row

- Collect all breakevens across all expiry groups (deduplicated by rounding to nearest integer).
- For each BE price: show `₹XX,XXX` and `(+X.X%)` / `(−X.X%)` relative to spot.
- Label: `B/E` in muted text.
- If no breakevens: show `"profitable at all prices"` or `"net loss at all prices"` depending on sign of At Spot.

### Visual style

- Three stat boxes in a row, separated by 1px border gaps, matching `bg-muted/20` card style.
- `stat-label`: 10px uppercase muted text.
- `stat-value`: 13px bold tabular-nums monospace; green (`text-emerald-500`) for profit, red (`text-rose-500`) for loss, muted for "Unlimited".
- BE row below stats, same card border. Chips styled like `bg-muted/30 border-border/40 rounded px-2 py-0.5`.

---

## Feature 2: Payoff Table Tab

### Tab bar

Added inside `index.tsx` (or `payoff-chart.tsx`). State: `activeTab: "chart" | "table"`, default `"chart"`.

Simple two-button toggle using shadcn `Tabs` or a lightweight custom implementation consistent with existing UI patterns.

### Chart tab

Unchanged — renders the existing `<PayoffChart>` SVG + legs table exactly as today.

### Table tab — `payoff-table.tsx`

#### Price ladder generation

```
interval = nearestRoundInterval(spot * 0.005)
```

`nearestRoundInterval` picks from a candidate list `[25, 50, 100, 250, 500]` by finding the candidate closest to `spot * 0.005`. For NIFTY (~24,000), `spot * 0.005 = 120` → nearest is 100. For SENSEX (~75,000), `spot * 0.005 = 375` → nearest is 250 (not 500, since |375−250|=125 < |375−500|=125; tie-break: pick smaller). For BANKNIFTY (~52,000), `spot * 0.005 = 260` → nearest is 250.

Generate rows: `floor(spot / interval) * interval` as the anchor, then 10 rows above and 10 rows below. Total: 21 rows (10 below, spot row, 10 above). The spot row uses the live spot value (not snapped to grid), highlighted separately.

#### Columns

| Column | Content |
|--------|---------|
| Price | `₹XX,XXX` + `(+X.X%)` or `(−X.X%)` from spot; spot row shows `₹XX,XXX ▸ now` |
| Per expiry (N columns) | `payoffAt(group.legs, price)`, formatted `+₹XX,XXX` green / `−₹XX,XXX` red |

Column headers for expiry columns: expiry date string (e.g. `15 May`) with the group color dot, matching chart legend colors.

If only one expiry group, one P&L column labeled with the expiry date.

#### Spot row

- Background: `bg-blue-950/40`
- Price cell: `text-blue-400 font-semibold`
- P&L values computed at live spot (not snapped).

#### Scroll behavior

Table is `max-h-[280px] overflow-y-auto` with the spot row scrolled into view on mount (`useEffect` + `scrollIntoView`).

### Props: `PayoffTableProps`

```ts
interface PayoffTableProps {
  groups: ExpiryGroup[];
  spot: number;
  groupColors: string[];
}
```

---

## Component Structure Changes

```
payoff-chart-dialog/
  index.tsx           ← add activeTab state, render StatsBar + tabs + conditional content
  payoff-chart.tsx    ← unchanged (still exported, rendered in chart tab)
  use-payoff-data.ts  ← unchanged
  stats-bar.tsx       ← NEW: Max Profit/Loss/At Spot + BE row
  payoff-table.tsx    ← NEW: price ladder table
```

`index.tsx` becomes the coordinator: calls `usePayoffData`, computes stats needed for `StatsBar`, passes data down to both `PayoffChart` and `PayoffTable`.

The curve-point computation (`groupCurves` — the 300-step `pts` arrays, breakevens, etc.) moves from `PayoffChart` up to `index.tsx` as a `useMemo`. Both `StatsBar` and `PayoffChart` receive `groupCurves` as a prop. `PayoffChart` is simplified: it receives pre-computed curves instead of recomputing them internally. This is the single source of truth for curve data.

---

## What's Out of Scope

- "Today's P&L" theta decay curve — requires Black-Scholes + live IV
- Open Interest bar overlay — requires market data feed
- Target price slider / date slider
- Hover tooltip / crosshair (not selected)
- SD markers (not selected)
