# Frontend React Refactor — Design Spec

**Date:** 2026-04-13  
**Scope:** Full refactor of `/frontend/src` — anti-pattern fixes, memoization, component decomposition, lazy loading  
**Strategy:** Feature-cluster approach (Approach 3) — each cluster gets all fixes in one pass

---

## Goals

1. Eliminate React anti-patterns (nested setState, useEffect-as-derived-state, sequential setState)
2. Add missing `useMemo` / `useCallback` to prevent unnecessary re-renders
3. Decompose large components (300+ lines) into focused sub-components using co-located subdirectories
4. Add `React.lazy` with per-dialog `Suspense` for heavy dialogs
5. Wrap appropriate leaf components in `React.memo`

---

## Cluster 1: Positions

### Files affected
- `panels/positions-panel/index.tsx` (539 lines → ~80 lines orchestrator)
- `panels/positions-panel/use-positions-feed.tsx` (decomposed — see Cluster 5)
- `panels/positions-panel/position-row.tsx` (add `React.memo`)
- `panels/positions-panel/position-action-dialogs.tsx` (unchanged)

### New structure
```
panels/positions-panel/
├── index.tsx                        (orchestrator, ~80 lines)
├── use-positions-feed.tsx           (decomposed — see Cluster 5)
├── position-row.tsx                 (+ React.memo)
├── position-action-dialogs.tsx      (unchanged)
├── filters/
│   └── position-filters.tsx         (broker/product filter bar)
├── table/
│   └── position-table.tsx           (table rendering, renderRow logic)
├── stats/
│   └── position-stats.tsx           (MTM summary, Greeks totals bar)
└── selection/
    └── selection-bar.tsx            (bulk action bar: square off, select all)
```

### Anti-patterns fixed
- `filtered`, `filteredMtmByBroker`, `openPositions`, `closedPositions`, `allOpenKeys` → wrapped in `useMemo`
- `handleAdd`, `handleShift`, `handleReduce`, `toggleSelectAll`, `toggleSelect` → wrapped in `useCallback`
- `renderRow` inline callback → extracted into `position-table.tsx` as a proper component
- `PositionRow` and `SelectionBar` wrapped in `React.memo`

---

## Cluster 2: Quick-trade

### Files affected
- `layout/quick-trade-dialog.tsx` (359 lines → decomposed)
- `layout/by-chain-tab.tsx` (504 lines → decomposed)
- `layout/order-dialog.tsx` (354 lines — anti-pattern fix only, no decomposition)

### New structure
```
layout/
├── quick-trade-dialog/
│   ├── index.tsx              (dialog shell + tab switcher, ~60 lines)
│   ├── by-price-content.tsx   (extracted from inline function)
│   ├── shared-controls.tsx    (broker selector, extracted from inline JSX)
│   └── by-chain-tab/
│       ├── index.tsx          (orchestrator, ~80 lines)
│       ├── chain-row.tsx      (individual chain row)
│       └── chain-controls.tsx (qty/mode/direction controls)
├── order-dialog.tsx           (keep as single file, apply useReducer fix)
```

### Anti-patterns fixed
- `order-dialog.tsx`: 9 sequential `setState` calls in `useEffect` → `useReducer` with single dispatch
- `sharedControls` inline JSX → `SharedControls` component with `React.memo`
- `ByPriceContent` inline function → proper component in `by-price-content.tsx`
- Parent callbacks into `ByChainTab` (`onQtyChange`, `onToggleMode`) → `useCallback` at call site
- `by-chain-tab/index.tsx` wrapped in `React.memo`

---

## Cluster 3: Profit-protection

### Files affected
- `terminal/profit-protection-panel.tsx` (528 lines → decomposed)

### New structure
```
terminal/
├── profit-protection-panel/
│   ├── index.tsx                  (tab shell + save logic, ~80 lines) ← lazy boundary
│   ├── broker-pp-form.tsx         (single broker form, rendered per tab)
│   ├── trailing-stop-section.tsx  (trailing SL conditional fields)
│   └── use-pp-draft.ts            (draft state, handlers, validation, save/reset)
```

### Anti-patterns fixed
- `makeDraft` manual field-by-field copy → mapping utility inside `use-pp-draft.ts`
- Repeated broker config render blocks → single `BrokerPpForm` component, one per tab
- `TrailingStopSection` extracted to eliminate duplication across broker tabs
- `use-pp-draft` encapsulates: draft state, memoized change handlers, validation, save/reset

### Lazy loading
- `profit-protection-panel/index.tsx` → `React.lazy`
- `Suspense` with spinner at usage site in `terminal-page.tsx`

---

## Cluster 4: Stats / Terminal

### Files affected
- `terminal/stats-bar.tsx` (320 lines → decomposed)
- `terminal/payoff-chart-dialog.tsx` (381 lines → decomposed)
- `pages/terminal-page.tsx` (245 lines — inline handler cleanup only)

### New structure
```
terminal/
├── stats-bar/
│   ├── index.tsx               (layout + display, ~80 lines)
│   ├── use-session-extremes.ts (maxProfit/maxLoss tracking hook)
│   └── pnl-badge.tsx           (reusable P&L colored badge)
├── payoff-chart-dialog/
│   ├── index.tsx               (dialog shell, ~40 lines) ← lazy boundary
│   ├── payoff-chart.tsx        (pure SVG rendering)
│   └── use-payoff-data.ts      (data aggregation + useMemo computations)
```

### Anti-patterns fixed
- `stats-bar.tsx` nested `setState` inside `useEffect` → `use-session-extremes.ts` using `useReducer({ maxProfit, maxLoss })` — single dispatch, no cascading
- `payoff-chart-dialog.tsx` data aggregation mixed with SVG rendering → `use-payoff-data.ts` owns all `useMemo`; `PayoffChart` is pure render
- `terminal-page.tsx` inline handlers → wrapped in `useCallback`; panel visibility `useState` calls consolidated

### Lazy loading
- `payoff-chart-dialog/index.tsx` → `React.lazy`
- `Suspense` with spinner at usage site in `terminal-page.tsx`

---

## Cluster 5: SignalR Hooks

### Files affected
- `panels/positions-panel/use-positions-feed.tsx` (222 lines → decomposed)
- `panels/option-chain-panel/use-option-chain.ts` (259+ lines → decomposed)
- `hooks/use-risk-feed.ts` (126 lines — unchanged, cohesive enough)

### New structure
```
panels/positions-panel/
├── use-positions-feed.tsx            (orchestrator, ~50 lines)
├── use-signalr-positions.ts          (SignalR connection + message handling)
└── use-positions-rest-fallback.ts    (REST fetch with broker token logic)

panels/option-chain-panel/
├── use-option-chain.ts               (orchestrator, composes below)
├── use-option-chain-feed.ts          (SignalR subscription + live strike tracking)
├── use-option-chain-refresh.ts       (60s periodic refresh + ATM calculation)
└── use-iv-history.ts                 (IV history accumulation)
```

### What gets fixed
- `use-positions-feed`: SignalR lifecycle, REST fallback, broker token resolution, and position state separated into focused hooks
- `use-option-chain`: 8 useState calls + SignalR + intervals + IV history untangled into single-concern hooks; orchestrator composes them
- Each sub-hook has one clear responsibility and can be understood independently

---

## Cluster 6: Zustand Store Cleanup

### Changes
- **`risk-state-store.ts`** (3 fields — TSL tracking) → deleted; replaced with `useState` local to the consuming component. No other component reads this store.
- All other stores unchanged (`risk-log-store`, `auth-store`, `broker-store`, `option-contracts-store`, `profit-protection-store`, `user-trading-settings-store`).

---

## Conventions Applied Throughout

| Rule | Application |
|------|-------------|
| `useMemo` | All derived arrays/objects computed from props or store state |
| `useCallback` | All callbacks passed as props to child components |
| `React.memo` | Leaf components that receive stable props after memoization fixes |
| `useReducer` | Replace 3+ related `useState` + sequential-setState patterns |
| `React.lazy` + `Suspense` | Heavy dialogs: profit-protection-panel, payoff-chart-dialog |
| Co-located subdirectories | Each decomposed component gets its own folder |
| Single-concern hooks | Each hook has one clear responsibility; orchestrators compose them |

---

## Out of Scope

- No introduction of React Query / TanStack Query
- No changes to `components/ui/` (shadcn)
- No changes to `services/` API layer
- No changes to `hooks/use-risk-feed.ts` (cohesive at 126 lines)
