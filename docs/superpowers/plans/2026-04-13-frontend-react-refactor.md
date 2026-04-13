# Frontend React Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate React anti-patterns, add missing memoization, decompose large components into co-located sub-folders, and lazy-load heavy dialogs across the frontend.

**Architecture:** Feature-cluster approach — each cluster (Positions, Quick-trade, Profit-protection, Stats/Terminal, SignalR hooks, Zustand cleanup) is refactored in one pass. Components decompose into co-located subdirectories. All callbacks passed as props get `useCallback`; all derived arrays get `useMemo`; leaf components that receive stable props get `React.memo`.

**Tech Stack:** React 19, TypeScript, Zustand, SignalR (`@microsoft/signalr`), Vite, shadcn/ui, Tailwind CSS

**Verification command** (no test suite): `cd frontend && npm run build` — must exit 0 after every cluster.

**Note on Cluster 6:** `risk-state-store.ts` is consumed by `use-risk-feed.ts`, `use-profit-protection.ts`, and `logout.ts` — it is genuine cross-component state and must be kept. Cluster 6 is a no-op.

---

## File Map

### Cluster 1 — Positions

| Action | Path |
|--------|------|
| Modify | `frontend/src/components/panels/positions-panel/index.tsx` |
| Create | `frontend/src/components/panels/positions-panel/filters/position-filters.tsx` |
| Create | `frontend/src/components/panels/positions-panel/stats/position-stats.tsx` |
| Create | `frontend/src/components/panels/positions-panel/table/position-table.tsx` |
| Modify | `frontend/src/components/panels/positions-panel/position-row.tsx` |

### Cluster 2 — Quick-trade

| Action | Path |
|--------|------|
| Modify | `frontend/src/components/panels/order-dialog.tsx` |
| Create | `frontend/src/components/layout/quick-trade-dialog/index.tsx` |
| Create | `frontend/src/components/layout/quick-trade-dialog/shared-controls.tsx` |
| Create | `frontend/src/components/layout/quick-trade-dialog/by-price-content.tsx` |
| Create | `frontend/src/components/layout/quick-trade-dialog/by-chain-tab/index.tsx` |
| Create | `frontend/src/components/layout/quick-trade-dialog/by-chain-tab/chain-controls.tsx` |
| Delete | `frontend/src/components/layout/quick-trade-dialog.tsx` |
| Delete | `frontend/src/components/layout/by-chain-tab.tsx` |

### Cluster 3 — Profit-protection

| Action | Path |
|--------|------|
| Create | `frontend/src/components/terminal/profit-protection-panel/use-pp-draft.ts` |
| Create | `frontend/src/components/terminal/profit-protection-panel/trailing-stop-section.tsx` |
| Create | `frontend/src/components/terminal/profit-protection-panel/broker-pp-form.tsx` |
| Create | `frontend/src/components/terminal/profit-protection-panel/index.tsx` |
| Delete | `frontend/src/components/terminal/profit-protection-panel.tsx` |
| Modify | `frontend/src/pages/terminal-page.tsx` (lazy import) |

### Cluster 4 — Stats / Terminal

| Action | Path |
|--------|------|
| Create | `frontend/src/components/terminal/stats-bar/use-session-extremes.ts` |
| Create | `frontend/src/components/terminal/stats-bar/pnl-badge.tsx` |
| Create | `frontend/src/components/terminal/stats-bar/index.tsx` |
| Delete | `frontend/src/components/terminal/stats-bar.tsx` |
| Create | `frontend/src/components/terminal/payoff-chart-dialog/use-payoff-data.ts` |
| Create | `frontend/src/components/terminal/payoff-chart-dialog/payoff-chart.tsx` |
| Create | `frontend/src/components/terminal/payoff-chart-dialog/index.tsx` |
| Delete | `frontend/src/components/terminal/payoff-chart-dialog.tsx` |
| Modify | `frontend/src/pages/terminal-page.tsx` (lazy load both dialogs) |

### Cluster 5 — SignalR Hooks

| Action | Path |
|--------|------|
| Create | `frontend/src/components/panels/positions-panel/use-signalr-positions.ts` |
| Create | `frontend/src/components/panels/positions-panel/use-positions-rest-fallback.ts` |
| Modify | `frontend/src/components/panels/positions-panel/use-positions-feed.tsx` |
| Create | `frontend/src/components/panels/option-chain-panel/use-option-chain-feed.ts` |
| Create | `frontend/src/components/panels/option-chain-panel/use-iv-history.ts` |
| Modify | `frontend/src/components/panels/option-chain-panel/use-option-chain.ts` |

---

## Cluster 1 — Positions

### Task 1.1: Extract PositionFilters

**Files:**
- Create: `frontend/src/components/panels/positions-panel/filters/position-filters.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/components/panels/positions-panel/filters/position-filters.tsx
import { memo } from "react";
import { cn } from "@/lib/utils";
import { BrokerBadge } from "@/components/ui/broker-badge";

interface PositionFiltersProps {
  brokerFilter: string | null;
  setBrokerFilter: (b: string | null) => void;
  productFilter: "Intraday" | "Delivery" | null;
  onProductFilterChange: (v: "Intraday" | "Delivery" | null) => void;
  brokersInPositions: string[];
  filteredMtmByBroker: Record<string, number>;
  showBrokerFilter: boolean;
  showProductFilter: boolean;
}

export const PositionFilters = memo(function PositionFilters({
  brokerFilter,
  setBrokerFilter,
  productFilter,
  onProductFilterChange,
  brokersInPositions,
  filteredMtmByBroker,
  showBrokerFilter,
  showProductFilter,
}: PositionFiltersProps) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/40 bg-muted/20 px-3">
      {showBrokerFilter && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setBrokerFilter(null)}
            className={cn(
              "cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
              brokerFilter === null
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {brokersInPositions.map((bId) => {
            const pnl = filteredMtmByBroker[bId];
            return (
              <button
                key={bId}
                onClick={() => setBrokerFilter(brokerFilter === bId ? null : bId)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                  brokerFilter === bId
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <BrokerBadge brokerId={bId} size={12} />
                {bId.charAt(0).toUpperCase() + bId.slice(1)}
                {pnl !== undefined && (
                  <span className={cn("font-mono tabular-nums", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {pnl >= 0 ? "+" : "-"}₹{Math.abs(pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {showBrokerFilter && showProductFilter && (
        <span className="text-border/60">|</span>
      )}

      {showProductFilter && (
        <div className="flex items-center gap-1">
          {([null, "Intraday", "Delivery"] as const).map((val) => (
            <button
              key={val ?? "all"}
              onClick={() => onProductFilterChange(val)}
              className={cn(
                "cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                productFilter === val
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {val === null ? "All" : val}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: exit 0, no errors in `position-filters.tsx`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/panels/positions-panel/filters/position-filters.tsx
git commit -m "refactor: extract PositionFilters component"
```

---

### Task 1.2: Extract PositionStats (table header with Greeks + actions)

**Files:**
- Create: `frontend/src/components/panels/positions-panel/stats/position-stats.tsx`

- [ ] **Step 1: Create the file**

This component renders the `<thead>` row: the select-all checkbox, column labels, Greeks display, and the Exit CEs / Exit PEs / Exit Selected action buttons. It receives all needed state and callbacks as props.

```tsx
// frontend/src/components/panels/positions-panel/stats/position-stats.tsx
import { memo } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PositionStatsProps {
  allSelected: boolean;
  someSelected: boolean;
  toggleSelectAll: () => void;
  selectedCount: number;
  acting: string | null;
  onExitSelected: () => void;
  onExitByType: (type: "CE" | "PE") => () => void;
  showGreeks: boolean;
  netDelta: number | undefined;
  netGamma: number;
  netVega: number;
  thetaPerDay: number;
  thetaEarnedToday: number;
}

export const PositionStats = memo(function PositionStats({
  allSelected,
  someSelected,
  toggleSelectAll,
  selectedCount,
  acting,
  onExitSelected,
  onExitByType,
  showGreeks,
  netDelta,
  netGamma,
  netVega,
  thetaPerDay,
  thetaEarnedToday,
}: PositionStatsProps) {
  return (
    <tr className="border-b border-border text-muted-foreground h-9">
      <th className="pl-3 py-1.5 w-7">
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={toggleSelectAll}
        />
      </th>
      <th className="px-3 py-1.5 text-left font-medium">Symbol</th>
      <th className="px-3 py-1.5 text-left font-medium">Product</th>
      <th className="px-3 py-1.5 text-right font-medium">Qty</th>
      <th className="px-3 py-1.5 text-right font-medium">Avg</th>
      <th className="px-3 py-1.5 text-right font-medium">LTP</th>
      <th className="px-3 py-1.5 text-right font-medium">P&amp;L</th>
      <th className="px-3 py-1.5">
        <div className="flex items-center justify-end gap-2">
          {showGreeks && netDelta !== undefined && (
            <span className="flex items-center gap-2.5 text-[10px] font-normal">
              {/* Delta */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex cursor-default items-center gap-0.5">
                    <span className="text-muted-foreground">Δ</span>
                    <span className={cn(
                      "font-mono tabular-nums font-medium",
                      Math.abs(netDelta) <= 0.1 ? "text-emerald-500" :
                      Math.abs(netDelta) <= 0.5 ? "text-amber-500" : "text-rose-500",
                    )}>
                      {netDelta >= 0 ? "+" : ""}{netDelta.toFixed(2)}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px] space-y-1 text-xs">
                  <p className="font-semibold">Net Delta (Δ)</p>
                  <p className="text-muted-foreground">
                    How much your portfolio moves per ₹1 rise in the underlying.{" "}
                    <span className="text-foreground">+{netDelta.toFixed(1)}</span> means you gain ₹{netDelta.toFixed(1)} for every ₹1 rise.
                  </p>
                  <p className={cn("font-medium",
                    Math.abs(netDelta) <= 0.1 ? "text-emerald-400" :
                    Math.abs(netDelta) <= 0.5 ? "text-amber-400" : "text-rose-400"
                  )}>
                    {Math.abs(netDelta) <= 0.1
                      ? "Balanced — ideal for sellers."
                      : Math.abs(netDelta) <= 0.5
                      ? "Slight directional bias — watch it."
                      : netDelta > 0
                      ? "Bullish skew — consider selling CEs or buying PEs to hedge."
                      : "Bearish skew — consider selling PEs or buying CEs to hedge."}
                  </p>
                </TooltipContent>
              </Tooltip>

              {/* Gamma */}
              {netGamma !== 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex cursor-default items-center gap-0.5">
                      <span className="text-muted-foreground">Γ</span>
                      <span className={cn(
                        "font-mono tabular-nums font-medium",
                        Math.abs(netGamma) <= 0.002 ? "text-emerald-500" :
                        Math.abs(netGamma) <= 0.01  ? "text-amber-500" : "text-rose-500",
                      )}>
                        {netGamma.toFixed(4)}
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px] space-y-1 text-xs">
                    <p className="font-semibold">Net Gamma (Γ)</p>
                    <p className="text-muted-foreground">
                      How fast your delta changes per ₹1 move. A delta of {netDelta.toFixed(1)} with gamma {netGamma.toFixed(4)} means after a ₹10 move, delta shifts by ~{(netGamma * 10).toFixed(2)}.
                    </p>
                    <p className={cn("font-medium",
                      Math.abs(netGamma) <= 0.002 ? "text-emerald-400" :
                      Math.abs(netGamma) <= 0.01  ? "text-amber-400" : "text-rose-400"
                    )}>
                      {netGamma < 0
                        ? Math.abs(netGamma) > 0.01
                          ? "High negative gamma — big moves hurt you, especially near expiry."
                          : "Moderate negative gamma — normal for short options."
                        : "Positive gamma — you benefit from large moves (long options)."}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Theta */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex cursor-default items-center gap-0.5">
                    <span className="text-muted-foreground">Θ</span>
                    <span className={cn("font-mono tabular-nums font-medium", thetaPerDay > 0 ? "text-emerald-500" : "text-rose-500")}>
                      {thetaEarnedToday !== 0
                        ? <>{thetaEarnedToday > 0 ? "+" : ""}₹{Math.round(thetaEarnedToday)} <span className="text-muted-foreground/50 font-normal">/ ₹{Math.round(thetaPerDay)}</span></>
                        : <>{thetaPerDay >= 0 ? "+" : ""}₹{Math.round(thetaPerDay)}/d</>
                      }
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px] space-y-1 text-xs">
                  <p className="font-semibold">Net Theta (Θ) — Time Decay</p>
                  <p className="text-muted-foreground">
                    Premium your portfolio earns (or loses) per day from time decay alone.
                    {thetaEarnedToday !== 0 && <> Today so far: <span className="text-foreground">₹{Math.round(thetaEarnedToday)}</span> out of a ₹{Math.round(thetaPerDay)}/day total.</>}
                  </p>
                  <p className={cn("font-medium", thetaPerDay > 0 ? "text-emerald-400" : "text-rose-400")}>
                    {thetaPerDay > 0
                      ? "Positive theta — time works in your favour (short options)."
                      : "Negative theta — you're paying decay (long options)."}
                  </p>
                </TooltipContent>
              </Tooltip>

              {/* Vega */}
              {netVega !== 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex cursor-default items-center gap-0.5">
                      <span className="text-muted-foreground">V</span>
                      <span className={cn("font-mono tabular-nums font-medium", netVega <= 0 ? "text-emerald-500" : "text-rose-500")}>
                        {netVega >= 0 ? "+" : ""}₹{Math.round(netVega)}
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px] space-y-1 text-xs">
                    <p className="font-semibold">Net Vega (V) — IV Sensitivity</p>
                    <p className="text-muted-foreground">
                      P&L change for every 1% rise in implied volatility. If IV rises 1%, your portfolio changes by <span className="text-foreground">₹{Math.round(netVega)}</span>.
                    </p>
                    <p className={cn("font-medium", netVega <= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {netVega < 0
                        ? "Negative vega — you profit when IV falls (normal for sellers). A volatility crush is your friend."
                        : "Positive vega — you profit when IV rises (long options / net buyer)."}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </span>
          )}

          {showGreeks && <span className="text-muted-foreground/30">|</span>}

          {/* Actions */}
          {selectedCount > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{selectedCount} selected</span>
              <Button
                size="sm"
                variant="destructive"
                className="h-5 px-2 text-[10px]"
                disabled={acting === "selected"}
                onClick={onExitSelected}
              >
                <LogOut className="mr-1 size-2.5" />
                {acting === "selected" ? "Exiting…" : `Exit ${selectedCount}`}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-5 px-2 text-[10px] text-rose-500 hover:bg-rose-500/10 hover:text-rose-500" disabled={!!acting} onClick={onExitByType("CE")}>
                Exit CEs
              </Button>
              <Button size="sm" variant="ghost" className="h-5 px-2 text-[10px] text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600" disabled={!!acting} onClick={onExitByType("PE")}>
                Exit PEs
              </Button>
            </div>
          )}
        </div>
      </th>
    </tr>
  );
});
```

- [ ] **Step 2: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/panels/positions-panel/stats/position-stats.tsx
git commit -m "refactor: extract PositionStats thead component"
```

---

### Task 1.3: Extract PositionTable

**Files:**
- Create: `frontend/src/components/panels/positions-panel/table/position-table.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/components/panels/positions-panel/table/position-table.tsx
import { memo } from "react";
import { LayoutList } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PositionRow } from "../position-row";
import { PositionStats } from "../stats/position-stats";
import type { Position } from "@/types";
import type { QtyMode } from "../qty-input";

interface PositionTableProps {
  openPositions: Position[];
  closedPositions: Position[];
  loading: boolean;
  newPositionKeys: Set<string>;
  qtys: Record<string, string>;
  qtyMode: QtyMode;
  acting: string | null;
  selected: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  selectedCount: number;
  showGreeks: boolean;
  netDelta: number | undefined;
  netGamma: number;
  netVega: number;
  thetaPerDay: number;
  thetaEarnedToday: number;
  toggleSelectAll: () => void;
  toggleSelect: (p: Position) => void;
  onQtyChange: (token: string, val: string) => void;
  onToggleMode: () => void;
  onAdd: (token: string, tradingSymbol: string, product: string, broker: string, exchange: string) => void;
  onReduce: (token: string, tradingSymbol: string, product: string, broker: string, exchange: string) => void;
  onShiftUp: (token: string, tradingSymbol: string, product: string, broker: string, exchange: string) => void;
  onShiftDown: (token: string, tradingSymbol: string, product: string, broker: string, exchange: string) => void;
  onExitSelected: () => void;
  onExitByType: (type: "CE" | "PE") => () => void;
}

const selKey = (p: Position) => `${p.instrumentToken}|${p.product}`;

export const PositionTable = memo(function PositionTable({
  openPositions,
  closedPositions,
  loading,
  newPositionKeys,
  qtys,
  qtyMode,
  acting,
  selected,
  allSelected,
  someSelected,
  selectedCount,
  showGreeks,
  netDelta,
  netGamma,
  netVega,
  thetaPerDay,
  thetaEarnedToday,
  toggleSelectAll,
  toggleSelect,
  onQtyChange,
  onToggleMode,
  onAdd,
  onReduce,
  onShiftUp,
  onShiftDown,
  onExitSelected,
  onExitByType,
}: PositionTableProps) {
  if (loading && openPositions.length === 0 && closedPositions.length === 0) {
    return (
      <table className="w-full text-xs">
        <tbody>
          {[0, 1, 2, 3, 4].map((i) => (
            <tr key={i} className="border-b border-border/30">
              <td className="px-3 py-2"><Skeleton className="h-3.5 w-3.5" /></td>
              <td className="px-3 py-2">
                <Skeleton className="mb-1 h-3.5 w-28" />
                <Skeleton className="h-2.5 w-20" />
              </td>
              <td className="px-3 py-2"><Skeleton className="h-3.5 w-14" /></td>
              <td className="px-3 py-2"><Skeleton className="h-3.5 w-8" /></td>
              <td className="px-3 py-2"><Skeleton className="h-3.5 w-14" /></td>
              <td className="px-3 py-2"><Skeleton className="h-3.5 w-14" /></td>
              <td className="px-3 py-2"><Skeleton className="h-3.5 w-16" /></td>
              <td className="px-3 py-2"><Skeleton className="h-3.5 w-14" /></td>
              <td className="px-3 py-2"><Skeleton className="ml-auto h-3.5 w-20" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (openPositions.length === 0 && closedPositions.length === 0 && !loading) {
    return <EmptyState icon={LayoutList} message="No positions" />;
  }

  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 z-10 bg-muted/20 backdrop-blur-sm">
        <PositionStats
          allSelected={allSelected}
          someSelected={someSelected}
          toggleSelectAll={toggleSelectAll}
          selectedCount={selectedCount}
          acting={acting}
          onExitSelected={onExitSelected}
          onExitByType={onExitByType}
          showGreeks={showGreeks}
          netDelta={netDelta}
          netGamma={netGamma}
          netVega={netVega}
          thetaPerDay={thetaPerDay}
          thetaEarnedToday={thetaEarnedToday}
        />
      </thead>
      <tbody>
        {openPositions.map((p) => (
          <PositionRow
            key={p.instrumentToken + p.product}
            position={p}
            isNew={newPositionKeys.has(p.instrumentToken + p.product)}
            qtyValue={qtys[p.instrumentToken] ?? ""}
            qtyMode={qtyMode}
            acting={acting}
            selected={selected.has(selKey(p))}
            onToggleSelect={() => toggleSelect(p)}
            onQtyChange={(v) => onQtyChange(p.instrumentToken, v)}
            onToggleMode={onToggleMode}
            onAdd={() => onAdd(p.instrumentToken, p.tradingSymbol, p.product, p.broker ?? "upstox", p.exchange)}
            onReduce={() => onReduce(p.instrumentToken, p.tradingSymbol, p.product, p.broker ?? "upstox", p.exchange)}
            onShiftUp={() => onShiftUp(p.instrumentToken, p.tradingSymbol, p.product, p.broker ?? "upstox", p.exchange ?? "")}
            onShiftDown={() => onShiftDown(p.instrumentToken, p.tradingSymbol, p.product, p.broker ?? "upstox", p.exchange ?? "")}
          />
        ))}
        {closedPositions.length > 0 && openPositions.length > 0 && (
          <tr>
            <td colSpan={11} className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 bg-muted/20">
              Closed
            </td>
          </tr>
        )}
        {closedPositions.map((p) => (
          <PositionRow
            key={p.instrumentToken + p.product}
            position={p}
            isNew={newPositionKeys.has(p.instrumentToken + p.product)}
            qtyValue={qtys[p.instrumentToken] ?? ""}
            qtyMode={qtyMode}
            acting={acting}
            selected={selected.has(selKey(p))}
            onToggleSelect={() => toggleSelect(p)}
            onQtyChange={(v) => onQtyChange(p.instrumentToken, v)}
            onToggleMode={onToggleMode}
            onAdd={() => onAdd(p.instrumentToken, p.tradingSymbol, p.product, p.broker ?? "upstox", p.exchange)}
            onReduce={() => onReduce(p.instrumentToken, p.tradingSymbol, p.product, p.broker ?? "upstox", p.exchange)}
            onShiftUp={() => onShiftUp(p.instrumentToken, p.tradingSymbol, p.product, p.broker ?? "upstox", p.exchange ?? "")}
            onShiftDown={() => onShiftDown(p.instrumentToken, p.tradingSymbol, p.product, p.broker ?? "upstox", p.exchange ?? "")}
          />
        ))}
      </tbody>
    </table>
  );
});
```

- [ ] **Step 2: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/panels/positions-panel/table/position-table.tsx
git commit -m "refactor: extract PositionTable component"
```

---

### Task 1.4: Refactor positions-panel/index.tsx as orchestrator + add memoization

**Files:**
- Modify: `frontend/src/components/panels/positions-panel/index.tsx`
- Modify: `frontend/src/components/panels/positions-panel/position-row.tsx` (add `React.memo`)

- [ ] **Step 1: Wrap PositionRow in React.memo**

Open `frontend/src/components/panels/positions-panel/position-row.tsx`. Find the export line (it will be `export function PositionRow(...`). Wrap it:

```tsx
// Before
export function PositionRow({ ... }: PositionRowProps) {

// After — add memo import at top, wrap export
import { memo } from "react";
// ... rest of imports unchanged ...

export const PositionRow = memo(function PositionRow({ ... }: PositionRowProps) {
  // ... body unchanged ...
});
```

- [ ] **Step 2: Rewrite positions-panel/index.tsx as orchestrator**

Replace the entire file with:

```tsx
// frontend/src/components/panels/positions-panel/index.tsx
import { useState, useCallback, useMemo } from "react";
import { toast } from "@/lib/toast";
import { exitPosition, placeMarketOrder, shiftPosition } from "@/services/trading-api";
import { getShiftOffset, UNDERLYING_KEYS } from "@/lib/shift-config";
import { getLotSize } from "@/lib/lot-sizes";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { useNewRows } from "@/hooks/use-new-rows";
import { PositionFilters } from "./filters/position-filters";
import { PositionTable } from "./table/position-table";
import type { QtyMode } from "./qty-input";
import type { Position } from "@/types";

interface PositionsPanelProps {
  positions: Position[];
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>;
  loading: boolean;
  isLive: boolean;
  load: () => void;
  netDelta?: number;
  thetaPerDay?: number;
  netGamma?: number;
  netVega?: number;
  productFilter: "Intraday" | "Delivery" | null;
  onProductFilterChange: (v: "Intraday" | "Delivery" | null) => void;
}

const selKey = (p: Position) => `${p.instrumentToken}|${p.product}`;

export function PositionsPanel({
  positions,
  loading,
  load,
  netDelta,
  thetaPerDay = 0,
  netGamma = 0,
  netVega = 0,
  productFilter,
  onProductFilterChange,
}: PositionsPanelProps) {
  const [acting, setActing] = useState<string | null>(null);
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [qtyMode, setQtyMode] = useState<QtyMode>("qty");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [brokerFilter, setBrokerFilter] = useState<string | null>(null);

  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);

  const setQty = useCallback((token: string, val: string) =>
    setQtys((prev) => ({ ...prev, [token]: val })), []);

  const toggleMode = useCallback(() => {
    setQtyMode((prev) => {
      const newMode: QtyMode = prev === "qty" ? "lot" : "qty";
      setQtys((prevQtys) => {
        const next: Record<string, string> = {};
        for (const p of positions) {
          const lot = getLotSize(p.tradingSymbol);
          const raw = parseInt(prevQtys[p.instrumentToken] ?? "", 10);
          if (isNaN(raw) || raw <= 0) { next[p.instrumentToken] = ""; continue; }
          next[p.instrumentToken] =
            newMode === "lot"
              ? String(Math.max(1, Math.round(raw / lot)))
              : String(raw * lot);
        }
        return next;
      });
      return newMode;
    });
  }, [positions]);

  const withActing = useCallback(async (key: string, fn: () => Promise<void>) => {
    setActing(key);
    try {
      await fn();
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(null);
    }
  }, [load]);

  const handleAdd = useCallback((token: string, tradingSymbol: string, product: string, broker: string, exchange: string) => {
    const lot = getLotSize(tradingSymbol);
    const num = parseInt(qtys[token] ?? "", 10);
    const qty = isNaN(num) || num <= 0 ? 0 : qtyMode === "lot" ? num * lot : num;
    const position = positions.find((p) => p.instrumentToken === token && p.product === product)!;
    const txn = position.quantity >= 0 ? "Buy" : "Sell";
    return withActing(token + ":add", () => placeMarketOrder(token, qty, txn, product, broker, exchange));
  }, [qtys, qtyMode, positions, withActing]);

  const handleShift = useCallback((token: string, tradingSymbol: string, product: string, direction: "up" | "down", broker: string, exchange: string) => {
    const lookup = getByInstrumentKey(token, tradingSymbol);
    if (!lookup) return;
    const { contract, index } = lookup;
    const lot = getLotSize(tradingSymbol);
    const num = parseInt(qtys[token] ?? "", 10);
    const qty = isNaN(num) || num <= 0 ? 0 : qtyMode === "lot" ? num * lot : num;
    if (qty === 0) return;
    const position = positions.find((p) => p.instrumentToken === token && p.product === product)!;
    const strikeGap = getShiftOffset(index);
    const underlyingKey = UNDERLYING_KEYS[index];
    return withActing(token + ":shift-" + direction, () =>
      shiftPosition(broker, {
        instrumentToken: token, exchange, qty, direction, product,
        currentStrike: contract.strikePrice, strikeGap, underlyingKey,
        expiry: contract.expiry, instrumentType: contract.instrumentType,
        isShort: position.quantity < 0,
      })
    );
  }, [qtys, qtyMode, positions, getByInstrumentKey, withActing]);

  const handleReduce = useCallback((token: string, tradingSymbol: string, product: string, broker: string, exchange: string) => {
    const lot = getLotSize(tradingSymbol);
    const num = parseInt(qtys[token] ?? "", 10);
    const qty = isNaN(num) || num <= 0 ? 0 : qtyMode === "lot" ? num * lot : num;
    const position = positions.find((p) => p.instrumentToken === token && p.product === product)!;
    const txn = position.quantity >= 0 ? "Sell" : "Buy";
    return withActing(token + ":reduce", () => placeMarketOrder(token, qty, txn, product, broker, exchange));
  }, [qtys, qtyMode, positions, withActing]);

  const posKey = useCallback((p: Position) => p.instrumentToken + p.product, []);
  const newPositionKeys = useNewRows(positions, posKey);

  // Derived filter metadata
  const brokersInPositions = useMemo(() =>
    Array.from(new Set(positions.map((p) => p.broker ?? "upstox"))), [positions]);
  const productTypesInPositions = useMemo(() =>
    Array.from(new Set(positions.map((p) => p.product))), [positions]);
  const showBrokerFilter = brokersInPositions.length > 1;
  const showProductFilter = productTypesInPositions.includes("Intraday") && productTypesInPositions.includes("Delivery");
  const showFilter = showBrokerFilter || showProductFilter;

  // Filtered and sorted positions (memoized)
  const filtered = useMemo(() =>
    positions
      .filter((p) => !brokerFilter || (p.broker ?? "upstox") === brokerFilter)
      .filter((p) => !productFilter || p.product === productFilter),
    [positions, brokerFilter, productFilter]);

  const filteredMtmByBroker = useMemo(() =>
    filtered.reduce<Record<string, number>>((acc, p) => {
      const key = p.broker ?? "upstox";
      acc[key] = (acc[key] ?? 0) + p.pnl;
      return acc;
    }, {}),
    [filtered]);

  const openPositions = useMemo(() => filtered.filter((p) => p.quantity !== 0), [filtered]);
  const closedPositions = useMemo(() => filtered.filter((p) => p.quantity === 0), [filtered]);

  // Selection
  const allOpenKeys = useMemo(() => openPositions.map(selKey), [openPositions]);
  const allSelected = allOpenKeys.length > 0 && allOpenKeys.every((k) => selected.has(k));
  const someSelected = allOpenKeys.some((k) => selected.has(k));
  const selectedCount = allOpenKeys.filter((k) => selected.has(k)).length;

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      const allSel = allOpenKeys.length > 0 && allOpenKeys.every((k) => prev.has(k));
      return allSel ? new Set() : new Set(allOpenKeys);
    });
  }, [allOpenKeys]);

  const toggleSelect = useCallback((p: Position) => {
    if (p.quantity === 0) return;
    const k = selKey(p);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }, []);

  const handleExitSelected = useCallback(async () => {
    const toExit = openPositions.filter((p) => selected.has(selKey(p)));
    setActing("selected");
    try {
      await Promise.all(toExit.map((p) => exitPosition(p.instrumentToken, p.product, p.broker ?? "upstox")));
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(null);
    }
  }, [openPositions, selected, load]);

  const handleExitByType = useCallback((instrumentType: "CE" | "PE") => async () => {
    const toExit = openPositions.filter((p) => {
      const lookup = getByInstrumentKey(p.instrumentToken, p.tradingSymbol);
      return lookup?.contract.instrumentType === instrumentType;
    });
    if (toExit.length === 0) return;
    setActing(`type-${instrumentType}`);
    try {
      await Promise.all(toExit.map((p) => exitPosition(p.instrumentToken, p.product, p.broker ?? "upstox")));
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(null);
    }
  }, [openPositions, getByInstrumentKey, load]);

  // Greeks
  const thetaEarnedToday = useMemo(() => {
    if (!thetaPerDay) return 0;
    const now = new Date();
    const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const totalMins = ist.getHours() * 60 + ist.getMinutes();
    if (totalMins < 9 * 60 + 15) return 0;
    const elapsed = Math.min(totalMins - (9 * 60 + 15), 375);
    return thetaPerDay * (elapsed / 375);
  }, [thetaPerDay]);

  const showGreeks = netDelta !== undefined && openPositions.length > 0 && (netDelta !== 0 || thetaPerDay !== 0);

  return (
    <div className="flex h-full flex-col">
      {showFilter && (
        <PositionFilters
          brokerFilter={brokerFilter}
          setBrokerFilter={setBrokerFilter}
          productFilter={productFilter}
          onProductFilterChange={onProductFilterChange}
          brokersInPositions={brokersInPositions}
          filteredMtmByBroker={filteredMtmByBroker}
          showBrokerFilter={showBrokerFilter}
          showProductFilter={showProductFilter}
        />
      )}
      <div className="flex-1 overflow-auto">
        <PositionTable
          openPositions={openPositions}
          closedPositions={closedPositions}
          loading={loading}
          newPositionKeys={newPositionKeys}
          qtys={qtys}
          qtyMode={qtyMode}
          acting={acting}
          selected={selected}
          allSelected={allSelected}
          someSelected={someSelected}
          selectedCount={selectedCount}
          showGreeks={showGreeks}
          netDelta={netDelta}
          netGamma={netGamma}
          netVega={netVega}
          thetaPerDay={thetaPerDay}
          thetaEarnedToday={thetaEarnedToday}
          toggleSelectAll={toggleSelectAll}
          toggleSelect={toggleSelect}
          onQtyChange={setQty}
          onToggleMode={toggleMode}
          onAdd={handleAdd}
          onReduce={handleReduce}
          onShiftUp={(token, sym, prod, broker, exch) => handleShift(token, sym, prod, "up", broker, exch)}
          onShiftDown={(token, sym, prod, broker, exch) => handleShift(token, sym, prod, "down", broker, exch)}
          onExitSelected={handleExitSelected}
          onExitByType={handleExitByType}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/panels/positions-panel/index.tsx \
        frontend/src/components/panels/positions-panel/position-row.tsx
git commit -m "refactor: positions-panel — orchestrator + useMemo/useCallback + React.memo"
```

---

## Cluster 2 — Quick-trade

### Task 2.1: Apply useReducer to order-dialog.tsx

**Files:**
- Modify: `frontend/src/components/panels/order-dialog.tsx`

- [ ] **Step 1: Add FormState type and reducer before the component**

Open `frontend/src/components/panels/order-dialog.tsx`. After the `Props` interface (after line 43), add:

```tsx
interface FormState {
  broker: string;
  direction: "Buy" | "Sell";
  qtyValue: string;
  qtyMode: "qty" | "lot";
  product: "Intraday" | "Delivery";
  orderType: "market" | "limit";
  limitPrice: string;
}

type FormAction =
  | { type: "RESET"; payload: FormState }
  | { type: "SET_BROKER"; broker: string }
  | { type: "SET_DIRECTION"; direction: "Buy" | "Sell" }
  | { type: "SET_QTY_VALUE"; value: string }
  | { type: "SET_QTY_MODE"; mode: "qty" | "lot"; newValue: string }
  | { type: "SET_PRODUCT"; product: "Intraday" | "Delivery" }
  | { type: "SET_ORDER_TYPE"; orderType: "market" | "limit"; limitPrice?: string }
  | { type: "SET_LIMIT_PRICE"; price: string };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "RESET":       return action.payload;
    case "SET_BROKER":  return { ...state, broker: action.broker };
    case "SET_DIRECTION": return { ...state, direction: action.direction };
    case "SET_QTY_VALUE": return { ...state, qtyValue: action.value };
    case "SET_QTY_MODE":  return { ...state, qtyMode: action.mode, qtyValue: action.newValue };
    case "SET_PRODUCT":   return { ...state, product: action.product };
    case "SET_ORDER_TYPE": return { ...state, orderType: action.orderType, ...(action.limitPrice !== undefined ? { limitPrice: action.limitPrice } : {}) };
    case "SET_LIMIT_PRICE": return { ...state, limitPrice: action.price };
    default: return state;
  }
}
```

- [ ] **Step 2: Replace the 7 useState calls with useReducer**

Replace imports line `import { useEffect, useMemo, useState } from "react";` with:

```tsx
import { useEffect, useMemo, useReducer } from "react";
```

Replace the 7 `useState` declarations at lines 61–68 with:

```tsx
const [form, dispatch] = useReducer(formReducer, {
  broker:     lockedBroker ?? activeBrokers[0]?.id ?? "upstox",
  direction:  intent?.transactionType ?? "Buy",
  qtyValue:   defaultQtyOverride ? String(defaultQtyOverride.value) : "1",
  qtyMode:    defaultQtyOverride?.mode ?? "lot",
  product:    lockedProduct ?? "Intraday",
  orderType:  "market",
  limitPrice: intent?.ltp.toFixed(2) ?? "0",
});
const { broker, direction, qtyValue, qtyMode, product, orderType, limitPrice } = form;
const [placing, setPlacing]           = useState(false);
const [availableMargin, setAvailable] = useState<number | null>(null);
```

- [ ] **Step 3: Replace the intent-reset useEffect**

Replace lines 72–87 (the first `useEffect`) with:

```tsx
useEffect(() => {
  if (!intent) return;
  dispatch({
    type: "RESET",
    payload: {
      direction:  intent.transactionType,
      orderType:  "market",
      product:    lockedProduct ?? "Intraday",
      broker:     lockedBroker ?? activeBrokers[0]?.id ?? "upstox",
      qtyValue:   defaultQtyOverride ? String(defaultQtyOverride.value) : "1",
      qtyMode:    defaultQtyOverride?.mode ?? "lot",
      limitPrice: intent.ltp.toFixed(2),
    },
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [intent?.instrumentKey]);
```

- [ ] **Step 4: Replace all setter calls in the JSX**

Replace every `setBroker(b.id)` → `dispatch({ type: "SET_BROKER", broker: b.id })`

Replace `setDirection((d) => d === "Buy" ? "Sell" : "Buy")` → `dispatch({ type: "SET_DIRECTION", direction: direction === "Buy" ? "Sell" : "Buy" })`

Replace `setProduct(p)` → `dispatch({ type: "SET_PRODUCT", product: p })`

Replace the `toggleMode` function:
```tsx
const toggleMode = () => {
  const cur = parseInt(qtyValue, 10);
  const next = qtyMode === "lot" ? "qty" : "lot";
  const newValue = !isNaN(cur) && cur > 0
    ? next === "qty" ? String(cur * lotSize) : String(Math.max(1, Math.round(cur / lotSize)))
    : qtyValue;
  dispatch({ type: "SET_QTY_MODE", mode: next, newValue });
};
```

Replace the limit price toggle button's `onClick`:
```tsx
onClick={() => {
  if (orderType === "market") {
    dispatch({ type: "SET_ORDER_TYPE", orderType: "limit", limitPrice: ltp.toFixed(2) });
  } else {
    dispatch({ type: "SET_ORDER_TYPE", orderType: "market" });
  }
}}
```

Replace `onChange={(e) => setLimitPrice(e.target.value)}` → `onChange={(e) => dispatch({ type: "SET_LIMIT_PRICE", price: e.target.value })}`

Replace `onChange={setQtyValue}` on `QtyInput` → `onChange={(v) => dispatch({ type: "SET_QTY_VALUE", value: v })}`

- [ ] **Step 5: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/panels/order-dialog.tsx
git commit -m "refactor: order-dialog — replace 7 useState with useReducer"
```

---

### Task 2.2: Decompose quick-trade-dialog + by-chain-tab

**Files:**
- Create `frontend/src/components/layout/quick-trade-dialog/shared-controls.tsx`
- Create `frontend/src/components/layout/quick-trade-dialog/by-price-content.tsx`
- Create `frontend/src/components/layout/quick-trade-dialog/by-chain-tab/chain-controls.tsx`
- Create `frontend/src/components/layout/quick-trade-dialog/by-chain-tab/index.tsx`
- Create `frontend/src/components/layout/quick-trade-dialog/index.tsx`
- Delete `frontend/src/components/layout/quick-trade-dialog.tsx`
- Delete `frontend/src/components/layout/by-chain-tab.tsx`

- [ ] **Step 1: Read by-chain-tab.tsx in full before proceeding**

```bash
cat frontend/src/components/layout/by-chain-tab.tsx
```

- [ ] **Step 2: Read quick-trade-dialog.tsx in full**

```bash
cat frontend/src/components/layout/quick-trade-dialog.tsx
```

- [ ] **Step 3: Create chain-controls.tsx**

Extract the qty input + mode toggle + direction selector from `by-chain-tab.tsx` into:

```tsx
// frontend/src/components/layout/quick-trade-dialog/by-chain-tab/chain-controls.tsx
import { memo } from "react";
import { QtyInput, type QtyMode } from "@/components/ui/qty-input";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";

interface ChainControlsProps {
  qtyValue: string;
  qtyMode: QtyMode;
  lotSize: number;
  onQtyChange: (v: string) => void;
  onToggleMode: () => void;
  direction: "Buy" | "Sell" | "BOTH";
  onDirectionChange: (d: "Buy" | "Sell" | "BOTH") => void;
}

export const ChainControls = memo(function ChainControls({
  qtyValue,
  qtyMode,
  lotSize,
  onQtyChange,
  onToggleMode,
  direction,
  onDirectionChange,
}: ChainControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <QtyInput
        value={qtyValue}
        mode={qtyMode}
        lotSize={lotSize}
        onChange={onQtyChange}
        onToggleMode={onToggleMode}
      />
      <div className="flex rounded border border-border/40 bg-muted/20">
        {(["Buy", "Sell", "BOTH"] as const).map((d) => (
          <button
            key={d}
            onClick={() => onDirectionChange(d)}
            className={cn(
              "px-2 py-1 text-xs font-medium transition-colors",
              direction === d
                ? d === "Buy" ? "bg-green-600 text-white" : d === "Sell" ? "bg-red-600 text-white" : "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {d === "Buy" ? <TrendingUp className="size-3" /> : d === "Sell" ? <TrendingDown className="size-3" /> : <ArrowUpDown className="size-3" />}
          </button>
        ))}
      </div>
    </div>
  );
});
```

- [ ] **Step 4: Create by-chain-tab/index.tsx**

Move all logic from `by-chain-tab.tsx` into this file, replacing the export name from `ByChainTab` to the same `ByChainTab`, adding `memo` wrap, and importing `ChainControls`:

```tsx
// frontend/src/components/layout/quick-trade-dialog/by-chain-tab/index.tsx
import { memo } from "react";
// ... copy all imports from by-chain-tab.tsx, update ChainControls import ...
import { ChainControls } from "./chain-controls";

// Copy full body of by-chain-tab.tsx, wrapping in memo:
export const ByChainTab = memo(function ByChainTab(props: /* existing Props type */) {
  // ... existing body unchanged except ChainControls extracted ...
});
```

> **Note:** The chain controls section (qty input + direction buttons) should be replaced by `<ChainControls .../>`. Keep all other logic (chain rows, strike display, order placement) identical.

- [ ] **Step 5: Create shared-controls.tsx**

Extract the broker selector + product radio from `quick-trade-dialog.tsx`'s `sharedControls` JSX variable:

```tsx
// frontend/src/components/layout/quick-trade-dialog/shared-controls.tsx
import { memo } from "react";
import { ArrowRightLeft, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface SharedControlsProps {
  bothConnected: boolean;
  broker: "upstox" | "zerodha";
  onBrokerChange: (b: "upstox" | "zerodha") => void;
  underlying: string;
  underlyings: string[];
  onUnderlyingChange: (u: string) => void;
  expiry: string;
  expiries: string[];
  onExpiryChange: (e: string) => void;
  product: "I" | "D";
  onProductChange: (p: "I" | "D") => void;
  formatExpiry: (s: string) => string;
}

export const SharedControls = memo(function SharedControls({
  bothConnected, broker, onBrokerChange,
  underlying, underlyings, onUnderlyingChange,
  expiry, expiries, onExpiryChange,
  product, onProductChange, formatExpiry,
}: SharedControlsProps) {
  // Copy the exact JSX from the sharedControls variable in quick-trade-dialog.tsx,
  // replacing all the inline state references with the props above.
  return (
    <div className="space-y-4">
      {/* broker selector — copy from sharedControls */}
      {/* underlying + expiry selects — copy from sharedControls */}
      {/* product toggle — copy from sharedControls */}
    </div>
  );
});
```

> **Note:** Copy the full JSX from the `sharedControls` variable in `quick-trade-dialog.tsx` (lines 86–173) verbatim, substituting state variables for the props.

- [ ] **Step 6: Create by-price-content.tsx**

Extract the `ByPriceContent` inline function from `quick-trade-dialog.tsx` (starting around line 244):

```tsx
// frontend/src/components/layout/quick-trade-dialog/by-price-content.tsx
import { memo } from "react";
// ... copy imports needed by ByPriceContent ...
import { SharedControls } from "./shared-controls";

interface ByPriceContentProps {
  // ... all props the inline function received from the closure ...
  sharedControlsProps: React.ComponentProps<typeof SharedControls>;
  // ... remaining order placement props ...
}

export const ByPriceContent = memo(function ByPriceContent(props: ByPriceContentProps) {
  // Copy full body of ByPriceContent from quick-trade-dialog.tsx
});
```

- [ ] **Step 7: Create quick-trade-dialog/index.tsx**

```tsx
// frontend/src/components/layout/quick-trade-dialog/index.tsx
import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLotSize } from "@/lib/lot-sizes";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { useBrokerStore } from "@/stores/broker-store";
import { UNDERLYING_KEYS } from "@/lib/shift-config";
import { SharedControls } from "./shared-controls";
import { ByPriceContent } from "./by-price-content";
import { ByChainTab } from "./by-chain-tab";
import type { QtyMode } from "@/components/ui/qty-input";

const UNDERLYINGS = Object.keys(UNDERLYING_KEYS);

// formatExpiry helper — copy from quick-trade-dialog.tsx

interface Props {
  onTabChange?: (tab: string) => void;
}

export function QuickTradeDialog({ onTabChange }: Props) {
  // Copy all state declarations from quick-trade-dialog.tsx

  const toggleQtyMode = useCallback(() => {
    // Copy toggleQtyMode body, wrap in useCallback
  }, [qtyValue, lotSize]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  }, [onTabChange]);

  const sharedControlsProps = {
    bothConnected,
    broker, onBrokerChange: setBroker,
    underlying, underlyings: UNDERLYINGS, onUnderlyingChange: setUnderlying,
    expiry, expiries, onExpiryChange: setExpiry,
    product, onProductChange: setProduct,
    formatExpiry,
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>...</TabsList>
      <TabsContent value="price">
        <ByPriceContent sharedControlsProps={sharedControlsProps} {...priceProps} />
      </TabsContent>
      <TabsContent value="chain">
        <SharedControls {...sharedControlsProps} />
        <ByChainTab
          underlying={underlying}
          expiry={expiry}
          broker={broker}
          product={product}
          qtyValue={qtyValue}
          qtyMode={qtyMode as QtyMode}
          onQtyChange={setQtyValue}
          onToggleMode={toggleQtyMode}
          lotSize={lotSize}
        />
      </TabsContent>
    </Tabs>
  );
}
```

> **Note:** The orchestrator holds all shared state and passes callbacks wrapped in `useCallback`. Wire up all props to `ByPriceContent` and `ByChainTab` as they were in the original file.

- [ ] **Step 8: Update all imports of the old paths**

```bash
# Find all files importing from the old paths
grep -r "from.*layout/quick-trade-dialog\"" frontend/src --include="*.tsx" --include="*.ts" -l
grep -r "from.*layout/by-chain-tab\"" frontend/src --include="*.tsx" --include="*.ts" -l
```

Update those files to import from the new paths:
- `@/components/layout/quick-trade-dialog` (the new folder's index)

- [ ] **Step 9: Delete old files**

```bash
rm frontend/src/components/layout/quick-trade-dialog.tsx
rm frontend/src/components/layout/by-chain-tab.tsx
```

- [ ] **Step 10: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/layout/quick-trade-dialog/
git add -u frontend/src/components/layout/quick-trade-dialog.tsx
git add -u frontend/src/components/layout/by-chain-tab.tsx
git commit -m "refactor: decompose quick-trade-dialog + by-chain-tab into co-located subfolders"
```

---

## Cluster 3 — Profit-protection

### Task 3.1: Create use-pp-draft.ts

**Files:**
- Create: `frontend/src/components/terminal/profit-protection-panel/use-pp-draft.ts`

- [ ] **Step 1: Create the file**

```ts
// frontend/src/components/terminal/profit-protection-panel/use-pp-draft.ts
import { useState, useCallback, useMemo } from "react";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import type { Position } from "@/types";

export interface Draft {
  enabled: boolean;
  watchedProducts: "All" | "Intraday" | "Delivery";
  mtmTarget: string;
  mtmSl: string;
  trailingEnabled: boolean;
  trailingActivateAt: string;
  lockProfitAt: string;
  increaseBy: string;
  trailBy: string;
  autoShiftEnabled: boolean;
  autoShiftThresholdPct: string;
  autoShiftMaxCount: string;
  autoShiftStrikeGap: string;
}

const DRAFT_KEYS: (keyof Draft)[] = [
  "enabled","watchedProducts","mtmTarget","mtmSl","trailingEnabled",
  "trailingActivateAt","lockProfitAt","increaseBy","trailBy",
  "autoShiftEnabled","autoShiftThresholdPct","autoShiftMaxCount","autoShiftStrikeGap",
];

function makeDraft(broker: string): Draft {
  const p = useProfitProtectionStore.getState().getConfig(broker);
  return {
    enabled:               p.enabled,
    watchedProducts:       p.watchedProducts,
    mtmTarget:             String(p.mtmTarget),
    mtmSl:                 String(p.mtmSl),
    trailingEnabled:       p.trailingEnabled,
    trailingActivateAt:    String(p.trailingActivateAt),
    lockProfitAt:          String(p.lockProfitAt),
    increaseBy:            String(p.increaseBy),
    trailBy:               String(p.trailBy),
    autoShiftEnabled:      p.autoShiftEnabled,
    autoShiftThresholdPct: String(p.autoShiftThresholdPct),
    autoShiftMaxCount:     String(p.autoShiftMaxCount),
    autoShiftStrikeGap:    String(p.autoShiftStrikeGap),
  };
}

export function usePpDraft(broker: string, positions: Position[]) {
  const [draft, setDraft] = useState<Draft>(() => makeDraft(broker));

  const resetToBroker = useCallback((b: string) => {
    setDraft(makeDraft(b));
  }, []);

  const setField = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const toggleEnabled = useCallback(() => {
    setDraft((d) => ({
      ...d,
      enabled: !d.enabled,
      ...(!d.enabled ? {} : { autoShiftEnabled: false, trailingEnabled: false }),
    }));
  }, []);

  // Derived numeric values
  const targetVal       = Number(draft.mtmTarget);
  const slVal           = Number(draft.mtmSl);
  const activateAtVal   = Number(draft.trailingActivateAt);
  const lockProfitAtVal = Number(draft.lockProfitAt);
  const increaseByVal   = Number(draft.increaseBy);
  const trailByVal      = Number(draft.trailBy);

  const hasInvalidNumbers = isNaN(targetVal) || isNaN(slVal) || isNaN(activateAtVal) || isNaN(lockProfitAtVal);

  const currentMtm = useMemo(() =>
    positions
      .filter((p) => (p.broker ?? "upstox") === broker)
      .filter((p) => draft.watchedProducts === "All" || p.product === draft.watchedProducts)
      .reduce((sum, p) => sum + p.pnl, 0),
    [positions, broker, draft.watchedProducts]);

  const warnings = {
    targetWarning:     !isNaN(targetVal)     && targetVal <= currentMtm,
    slWarning:         !isNaN(slVal)         && slVal >= currentMtm,
    activateAtWarning: draft.trailingEnabled && !isNaN(activateAtVal) && !isNaN(targetVal) && activateAtVal >= targetVal,
    lockProfitWarning: draft.trailingEnabled && !isNaN(lockProfitAtVal) && !isNaN(targetVal) && lockProfitAtVal >= targetVal,
  };

  const canSave = !hasInvalidNumbers && !Object.values(warnings).some(Boolean);

  const toSavePayload = () => ({
    enabled:               draft.enabled,
    watchedProducts:       draft.watchedProducts,
    mtmTarget:             targetVal,
    mtmSl:                 slVal,
    trailingEnabled:       draft.trailingEnabled,
    trailingActivateAt:    activateAtVal,
    lockProfitAt:          lockProfitAtVal,
    increaseBy:            Number(draft.increaseBy),
    trailBy:               Number(draft.trailBy),
    autoShiftEnabled:      draft.autoShiftEnabled,
    autoShiftThresholdPct: Number(draft.autoShiftThresholdPct),
    autoShiftMaxCount:     Number(draft.autoShiftMaxCount),
    autoShiftStrikeGap:    Number(draft.autoShiftStrikeGap),
  });

  return {
    draft, setField, toggleEnabled, resetToBroker,
    currentMtm, warnings, canSave, toSavePayload,
    increaseByVal, trailByVal, slVal, activateAtVal, lockProfitAtVal,
  };
}
```

- [ ] **Step 2: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/terminal/profit-protection-panel/use-pp-draft.ts
git commit -m "refactor: extract use-pp-draft hook"
```

---

### Task 3.2: Create TrailingStopSection and BrokerPpForm

**Files:**
- Create: `frontend/src/components/terminal/profit-protection-panel/trailing-stop-section.tsx`
- Create: `frontend/src/components/terminal/profit-protection-panel/broker-pp-form.tsx`

- [ ] **Step 1: Create trailing-stop-section.tsx**

Extract the trailing SL fields from `profit-protection-panel.tsx` (lines 353–438):

```tsx
// frontend/src/components/terminal/profit-protection-panel/trailing-stop-section.tsx
import { memo } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { Draft } from "./use-pp-draft";

interface TrailingStopSectionProps {
  draft: Draft;
  onField: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  activateAtWarning: boolean;
  lockProfitWarning: boolean;
  increaseByVal: number;
  trailByVal: number;
  slVal: number;
  activateAtVal: number;
  lockProfitAtVal: number;
}

export const TrailingStopSection = memo(function TrailingStopSection({
  draft, onField, activateAtWarning, lockProfitWarning,
  increaseByVal, trailByVal, slVal, activateAtVal, lockProfitAtVal,
}: TrailingStopSectionProps) {
  return (
    <div className={cn("space-y-5 transition-opacity", !draft.trailingEnabled && "pointer-events-none opacity-40")}>
      {/* grid of 4 inputs: trailingActivateAt, lockProfitAt, increaseBy, trailBy */}
      {/* Copy from profit-protection-panel.tsx lines 354–423 */}
      {/* trailing summary paragraph — copy from lines 426–438 */}
    </div>
  );
});
```

> Copy the full JSX from `profit-protection-panel.tsx` lines 353–438 into the return statement, replacing `draft.xxx` references with the `draft` prop and `setStr` calls with `onField(key, value)`.

- [ ] **Step 2: Create broker-pp-form.tsx**

Extract the Tabs content (both tabs) into a single component for one broker:

```tsx
// frontend/src/components/terminal/profit-protection-panel/broker-pp-form.tsx
import { memo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TrailingStopSection } from "./trailing-stop-section";
import type { Draft } from "./use-pp-draft";

// Copy Toggle component from profit-protection-panel.tsx (the local Toggle function)

interface BrokerPpFormProps {
  draft: Draft;
  onField: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  toggleEnabled: () => void;
  targetWarning: boolean;
  slWarning: boolean;
  activateAtWarning: boolean;
  lockProfitWarning: boolean;
  increaseByVal: number;
  trailByVal: number;
  slVal: number;
  activateAtVal: number;
  lockProfitAtVal: number;
}

export const BrokerPpForm = memo(function BrokerPpForm({
  draft, onField, toggleEnabled,
  targetWarning, slWarning, activateAtWarning, lockProfitWarning,
  increaseByVal, trailByVal, slVal, activateAtVal, lockProfitAtVal,
}: BrokerPpFormProps) {
  return (
    <div className={cn("transition-opacity duration-200", !draft.enabled && "pointer-events-none opacity-40")}>
      <Tabs defaultValue="limits" className="w-full">
        {/* TabsList — copy from profit-protection-panel.tsx */}
        <TabsContent value="limits">
          {/* watchedProducts selector — copy from lines 277–302 */}
          {/* mtmTarget + mtmSl grid — copy from lines 304–341 */}
          {/* trailingEnabled toggle — copy from lines 343–350 */}
          <TrailingStopSection
            draft={draft}
            onField={onField}
            activateAtWarning={activateAtWarning}
            lockProfitWarning={lockProfitWarning}
            increaseByVal={increaseByVal}
            trailByVal={trailByVal}
            slVal={slVal}
            activateAtVal={activateAtVal}
            lockProfitAtVal={lockProfitAtVal}
          />
        </TabsContent>
        <TabsContent value="autoshift">
          {/* autoshift content — copy from lines 443–514 */}
        </TabsContent>
      </Tabs>
    </div>
  );
});
```

- [ ] **Step 3: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/terminal/profit-protection-panel/trailing-stop-section.tsx \
        frontend/src/components/terminal/profit-protection-panel/broker-pp-form.tsx
git commit -m "refactor: extract TrailingStopSection and BrokerPpForm"
```

---

### Task 3.3: Create profit-protection-panel/index.tsx + lazy load

**Files:**
- Create: `frontend/src/components/terminal/profit-protection-panel/index.tsx`
- Delete: `frontend/src/components/terminal/profit-protection-panel.tsx`
- Modify: `frontend/src/pages/terminal-page.tsx`

- [ ] **Step 1: Create the orchestrator index.tsx**

```tsx
// frontend/src/components/terminal/profit-protection-panel/index.tsx
import { useState, useCallback } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRiskConfig } from "@/hooks/use-risk-config";
import { useBrokerStore } from "@/stores/broker-store";
import { BROKERS } from "@/lib/constants";
import { useShallow } from "zustand/react/shallow";
import { usePpDraft } from "./use-pp-draft";
import { BrokerPpForm } from "./broker-pp-form";
import type { Position } from "@/types";

interface ProfitProtectionPanelProps {
  open: boolean;
  onClose: () => void;
  positions: Position[];
}

export function ProfitProtectionPanel({ open, onClose, positions }: ProfitProtectionPanelProps) {
  const connectedBrokers = useBrokerStore(useShallow((s) => BROKERS.filter((b) => s.isAuthenticated(b.id))));
  const multipleConnected = connectedBrokers.length > 1;
  const defaultBroker = connectedBrokers[0]?.id ?? "upstox";
  const [activeBroker, setActiveBroker] = useState(defaultBroker);

  const upstoxConfig  = useRiskConfig("upstox");
  const zerodhaConfig = useRiskConfig("zerodha");
  const dhanConfig    = useRiskConfig("dhan");
  const riskConfigs: Record<string, ReturnType<typeof useRiskConfig>> = {
    upstox: upstoxConfig, zerodha: zerodhaConfig, dhan: dhanConfig,
  };

  const {
    draft, setField, toggleEnabled, resetToBroker,
    currentMtm, warnings, canSave, toSavePayload,
    increaseByVal, trailByVal, slVal, activateAtVal, lockProfitAtVal,
  } = usePpDraft(activeBroker, positions);

  // Reset when dialog opens
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) { onClose(); return; }
    const broker = connectedBrokers[0]?.id ?? "upstox";
    setActiveBroker(broker);
    resetToBroker(broker);
  }, [connectedBrokers, onClose, resetToBroker]);

  const handleBrokerSwitch = useCallback((broker: string) => {
    setActiveBroker(broker);
    resetToBroker(broker);
  }, [resetToBroker]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    const { save } = riskConfigs[activeBroker] ?? upstoxConfig;
    await save(toSavePayload());
    const name = connectedBrokers.find((b) => b.id === activeBroker)?.name ?? activeBroker;
    toast.success(`${name} — configuration saved`);
    onClose();
  }, [canSave, activeBroker, riskConfigs, upstoxConfig, toSavePayload, connectedBrokers, onClose]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-green-500" />
            Profit Protection
            {multipleConnected && (
              <span className="text-sm font-normal text-muted-foreground">
                — {connectedBrokers.find((b) => b.id === activeBroker)?.name ?? activeBroker}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Status banner — copy from profit-protection-panel.tsx lines 186–259, replacing state refs */}

        <BrokerPpForm
          draft={draft}
          onField={setField}
          toggleEnabled={toggleEnabled}
          targetWarning={warnings.targetWarning}
          slWarning={warnings.slWarning}
          activateAtWarning={warnings.activateAtWarning}
          lockProfitWarning={warnings.lockProfitWarning}
          increaseByVal={increaseByVal}
          trailByVal={trailByVal}
          slVal={slVal}
          activateAtVal={activateAtVal}
          lockProfitAtVal={lockProfitAtVal}
        />

        <div className="flex justify-end gap-2 border-t border-border/50 px-6 py-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handleSave} disabled={!canSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Delete old file**

```bash
rm frontend/src/components/terminal/profit-protection-panel.tsx
```

- [ ] **Step 3: Add React.lazy in terminal-page.tsx**

Open `frontend/src/pages/terminal-page.tsx`. Find the import of `ProfitProtectionPanel`. Replace:

```tsx
// Before
import { ProfitProtectionPanel } from "@/components/terminal/profit-protection-panel";

// After — add to top of file alongside other lazy imports
import { lazy, Suspense } from "react";
const ProfitProtectionPanel = lazy(() =>
  import("@/components/terminal/profit-protection-panel").then((m) => ({ default: m.ProfitProtectionPanel }))
);
```

Then in the JSX, wrap the usage with Suspense:

```tsx
<Suspense fallback={<div className="flex items-center justify-center p-8 text-muted-foreground text-sm">Loading…</div>}>
  <ProfitProtectionPanel
    open={ppOpen}
    onClose={() => setPpOpen(false)}
    positions={positions}
  />
</Suspense>
```

- [ ] **Step 4: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/terminal/profit-protection-panel/
git add -u frontend/src/components/terminal/profit-protection-panel.tsx
git add frontend/src/pages/terminal-page.tsx
git commit -m "refactor: decompose profit-protection-panel + lazy load"
```

---

## Cluster 4 — Stats / Terminal

### Task 4.1: Create use-session-extremes.ts

**Files:**
- Create: `frontend/src/components/terminal/stats-bar/use-session-extremes.ts`

- [ ] **Step 1: Create the file**

```ts
// frontend/src/components/terminal/stats-bar/use-session-extremes.ts
import { useReducer, useEffect } from "react";

const STORAGE_KEY = "kai-terminal-mtm-extremes";

interface ExtremesState {
  maxProfit: number | null;
  maxLoss: number | null;
}

type ExtremesAction = { type: "UPDATE"; pnl: number } | { type: "RESET" };

function readStored(): ExtremesState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { maxProfit: null, maxLoss: null };
  } catch {
    return { maxProfit: null, maxLoss: null };
  }
}

function extremesReducer(state: ExtremesState, action: ExtremesAction): ExtremesState {
  if (action.type === "RESET") return { maxProfit: null, maxLoss: null };
  const { pnl } = action;
  const maxProfit = state.maxProfit === null || pnl > state.maxProfit ? pnl : state.maxProfit;
  const maxLoss   = state.maxLoss   === null || pnl < state.maxLoss   ? pnl : state.maxLoss;
  if (maxProfit === state.maxProfit && maxLoss === state.maxLoss) return state;
  const next = { maxProfit, maxLoss };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function useSessionExtremes(allPnl: number, hasPositions: boolean) {
  const [extremes, dispatch] = useReducer(extremesReducer, undefined, readStored);

  useEffect(() => {
    if (!hasPositions) return;
    dispatch({ type: "UPDATE", pnl: allPnl });
  }, [allPnl, hasPositions]);

  return extremes;
}
```

- [ ] **Step 2: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/terminal/stats-bar/use-session-extremes.ts
git commit -m "refactor: extract use-session-extremes (fixes nested setState anti-pattern)"
```

---

### Task 4.2: Decompose stats-bar into folder

**Files:**
- Create: `frontend/src/components/terminal/stats-bar/pnl-badge.tsx`
- Create: `frontend/src/components/terminal/stats-bar/index.tsx`
- Delete: `frontend/src/components/terminal/stats-bar.tsx`

- [ ] **Step 1: Create pnl-badge.tsx**

```tsx
// frontend/src/components/terminal/stats-bar/pnl-badge.tsx
import { memo } from "react";
import { cn } from "@/lib/utils";

interface PnlBadgeProps {
  value: number;
  prefix?: string;
}

export const PnlBadge = memo(function PnlBadge({ value, prefix = "" }: PnlBadgeProps) {
  return (
    <span className={cn("font-mono tabular-nums font-medium", value >= 0 ? "text-emerald-500" : "text-rose-500")}>
      {prefix}{value >= 0 ? "+" : "-"}₹{Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
    </span>
  );
});
```

- [ ] **Step 2: Create stats-bar/index.tsx**

Create this file by copying `stats-bar.tsx` verbatim, then applying these two targeted changes:

1. Replace the two `useState` for extremes and the `useEffect` with a call to `useSessionExtremes`:

```tsx
// Remove these lines:
// const [maxProfit, setMaxProfit] = useState<number | null>(() => readStored().maxProfit);
// const [maxLoss, setMaxLoss] = useState<number | null>(() => readStored().maxLoss);
// const readStored = ...
// const STORAGE_KEY = ...
// useEffect(() => { ... }, [allPnl, positions.length]);

// Add at top of component:
import { useSessionExtremes } from "./use-session-extremes";
// ...
const { maxProfit, maxLoss } = useSessionExtremes(allPnl, positions.length > 0);
```

2. Replace inline `<span className={cn("font-mono tabular-nums font-medium", ...)}>{maxProfit >= 0 ? "+" : "-"}₹{...}</span>` uses for `maxProfit`/`maxLoss` display with `<PnlBadge value={maxProfit} />` / `<PnlBadge value={maxLoss} />`.

3. Update the import of `PayoffChartDialog` to the new lazy path (done in Task 4.3).

- [ ] **Step 3: Delete old file**

```bash
rm frontend/src/components/terminal/stats-bar.tsx
```

- [ ] **Step 4: Update imports in files that use StatsBar**

```bash
grep -r "from.*terminal/stats-bar\"" frontend/src --include="*.tsx" --include="*.ts" -l
```

Update each found file to import from `@/components/terminal/stats-bar` (same path, now resolves to index.tsx — no change needed if using directory imports).

- [ ] **Step 5: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/terminal/stats-bar/
git add -u frontend/src/components/terminal/stats-bar.tsx
git commit -m "refactor: decompose stats-bar + fix nested setState via use-session-extremes"
```

---

### Task 4.3: Decompose payoff-chart-dialog + lazy load

**Files:**
- Create: `frontend/src/components/terminal/payoff-chart-dialog/use-payoff-data.ts`
- Create: `frontend/src/components/terminal/payoff-chart-dialog/payoff-chart.tsx`
- Create: `frontend/src/components/terminal/payoff-chart-dialog/index.tsx`
- Delete: `frontend/src/components/terminal/payoff-chart-dialog.tsx`
- Modify: `frontend/src/components/terminal/stats-bar/index.tsx` (lazy import)

- [ ] **Step 1: Read payoff-chart-dialog.tsx in full**

```bash
cat frontend/src/components/terminal/payoff-chart-dialog.tsx
```

- [ ] **Step 2: Create use-payoff-data.ts**

Extract the `groups` useMemo and spot price feed logic from `payoff-chart-dialog.tsx` into a hook:

```ts
// frontend/src/components/terminal/payoff-chart-dialog/use-payoff-data.ts
import { useMemo } from "react";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { useIndicesFeed } from "@/hooks/use-indices-feed";
import type { Position } from "@/types";

// Copy Leg and ExpiryGroup interfaces from payoff-chart-dialog.tsx
// Copy INDEX_TO_FEED constant
// Copy payoffAt function

export function usePayoffData(positions: Position[], open: boolean) {
  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);
  const feed = useIndicesFeed();

  const groups = useMemo(() => {
    // Copy the useMemo body from payoff-chart-dialog.tsx that builds ExpiryGroup[]
    // (the groups calculation using positions + getByInstrumentKey)
  }, [positions, getByInstrumentKey, open]);

  const spotByIndex = useMemo(() => {
    // Build a map of index → spot price from feed
    const map: Record<string, number> = {};
    for (const [index, feedKey] of Object.entries(INDEX_TO_FEED)) {
      const val = feed[feedKey as keyof typeof feed];
      if (val?.ltp) map[index] = val.ltp;
    }
    return map;
  }, [feed]);

  return { groups, spotByIndex };
}
```

- [ ] **Step 3: Create payoff-chart.tsx**

Extract only the SVG chart rendering from `payoff-chart-dialog.tsx`:

```tsx
// frontend/src/components/terminal/payoff-chart-dialog/payoff-chart.tsx
import { memo } from "react";
import { cn } from "@/lib/utils";
// Copy W, H, PAD, DW, DH, GROUP_COLORS, INR, fmtY constants
// Copy ExpiryGroup and Leg interfaces
// Copy payoffAt function

interface PayoffChartProps {
  groups: ExpiryGroup[];
  spotByIndex: Record<string, number>;
}

export const PayoffChart = memo(function PayoffChart({ groups, spotByIndex }: PayoffChartProps) {
  // Copy the full SVG rendering from payoff-chart-dialog.tsx
  // (the section that builds the SVG path data and renders the chart)
});
```

- [ ] **Step 4: Create payoff-chart-dialog/index.tsx**

```tsx
// frontend/src/components/terminal/payoff-chart-dialog/index.tsx
import { BarChart2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePayoffData } from "./use-payoff-data";
import { PayoffChart } from "./payoff-chart";
import type { Position } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positions: Position[];
}

export function PayoffChartDialog({ open, onOpenChange, positions }: Props) {
  const { groups, spotByIndex } = usePayoffData(positions, open);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart2 className="size-4" /> P&amp;L at Expiry
          </DialogTitle>
        </DialogHeader>
        {/* Legend + chart — copy non-data-fetching JSX from payoff-chart-dialog.tsx */}
        <PayoffChart groups={groups} spotByIndex={spotByIndex} />
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Delete old file**

```bash
rm frontend/src/components/terminal/payoff-chart-dialog.tsx
```

- [ ] **Step 6: Add React.lazy in stats-bar/index.tsx**

In `frontend/src/components/terminal/stats-bar/index.tsx`, replace the direct import:

```tsx
// Before
import { PayoffChartDialog } from "../payoff-chart-dialog";

// After
import { lazy, Suspense } from "react";
const PayoffChartDialog = lazy(() =>
  import("../payoff-chart-dialog").then((m) => ({ default: m.PayoffChartDialog }))
);
```

Wrap its usage in the JSX:

```tsx
<Suspense fallback={null}>
  <PayoffChartDialog
    open={payoffOpen}
    onOpenChange={setPayoffOpen}
    positions={positions}
  />
</Suspense>
```

- [ ] **Step 7: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/terminal/payoff-chart-dialog/
git add frontend/src/components/terminal/stats-bar/index.tsx
git add -u frontend/src/components/terminal/payoff-chart-dialog.tsx
git commit -m "refactor: decompose payoff-chart-dialog + lazy load from stats-bar"
```

---

## Cluster 5 — SignalR Hooks

### Task 5.1: Decompose use-positions-feed.tsx

**Files:**
- Create: `frontend/src/components/panels/positions-panel/use-signalr-positions.ts`
- Create: `frontend/src/components/panels/positions-panel/use-positions-rest-fallback.ts`
- Modify: `frontend/src/components/panels/positions-panel/use-positions-feed.tsx`

- [ ] **Step 1: Create use-positions-rest-fallback.ts**

Extract the `load` callback from `use-positions-feed.tsx` (lines 75–92):

```ts
// frontend/src/components/panels/positions-panel/use-positions-rest-fallback.ts
import { useState, useCallback } from "react";
import { fetchPositions, fetchZerodhaPositions } from "@/services/trading-api";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { useBrokerStore } from "@/stores/broker-store";
import type { Position } from "@/types";

export function usePositionsRestFallback() {
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (exchanges?: string[]) => {
    setLoading(true);
    try {
      const { getCredentials } = useBrokerStore.getState();
      const upstoxToken  = getCredentials("upstox")?.accessToken;
      const zerodhaToken = getCredentials("zerodha")?.accessToken;
      const hasUpstox  = !!upstoxToken  && !isBrokerTokenExpired("upstox",  upstoxToken);
      const hasZerodha = !isBrokerTokenExpired("zerodha", zerodhaToken) && !!zerodhaToken;
      const [upstox, zerodha] = await Promise.all([
        hasUpstox  ? fetchPositions(exchanges)        : Promise.resolve([] as Position[]),
        hasZerodha ? fetchZerodhaPositions(exchanges) : Promise.resolve([] as Position[]),
      ]);
      return [...upstox, ...zerodha];
    } finally {
      setLoading(false);
    }
  }, []);

  return { load, loading };
}
```

- [ ] **Step 2: Create use-signalr-positions.ts**

Extract the SignalR `useEffect` from `use-positions-feed.tsx` (lines 94–219). The symbol-parsing helpers (`formatFallbackSymbol`, `expiryShort`, `ordinalDay`, constants) stay in this file since they're only used here:

```ts
// frontend/src/components/panels/positions-panel/use-signalr-positions.ts
import { useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { toast as sonner } from "sonner";
import { toast } from "@/lib/toast";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { API_BASE_URL } from "@/lib/constants";
import { useBrokerStore } from "@/stores/broker-store";
import { useAuthStore } from "@/stores/auth-store";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import type { Position } from "@/types";

// Copy KNOWN_UNDERLYINGS, MONTH_ABBR, WEEKLY_MONTH_CODE constants
// Copy ordinalDay, expiryShort, formatFallbackSymbol helpers

interface UseSignalrPositionsOptions {
  onPositions: (positions: Position[]) => void;
  onLtpBatch: (updates: Array<{ instrumentToken: string; ltp: number }>) => void;
  onOrderUpdate?: () => void;
  onFallbackLoad: () => void;
}

export function useSignalrPositions({
  onPositions,
  onLtpBatch,
  onOrderUpdate,
  onFallbackLoad,
}: UseSignalrPositionsOptions) {
  const [isLive, setIsLive] = useState(false);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    // Copy the full useEffect body from use-positions-feed.tsx lines 94–219
    // Replace setPositions calls with onPositions / onLtpBatch callbacks
    // Replace load() call with onFallbackLoad()
  }, [onPositions, onLtpBatch, onOrderUpdate, onFallbackLoad]);

  return { isLive };
}
```

- [ ] **Step 3: Rewrite use-positions-feed.tsx as orchestrator**

```tsx
// frontend/src/components/panels/positions-panel/use-positions-feed.tsx
import { useState, useCallback } from "react";
import { usePositionsRestFallback } from "./use-positions-rest-fallback";
import { useSignalrPositions } from "./use-signalr-positions";
import type { Position } from "@/types";

export function usePositionsFeed(onOrderUpdate?: () => void) {
  const [positions, setPositions] = useState<Position[]>([]);

  const { load: restLoad, loading } = usePositionsRestFallback();

  const load = useCallback(async (exchanges?: string[]) => {
    const result = await restLoad(exchanges);
    setPositions(result);
  }, [restLoad]);

  const handlePositions = useCallback((incoming: Position[]) => {
    setPositions((prev) => {
      if (prev.length === 0) return incoming;
      const liveMap = new Map(prev.map((p) => [p.instrumentToken, p]));
      return incoming.map((p) => {
        const live = liveMap.get(p.instrumentToken);
        if (!live) return p;
        const ltp = live.ltp;
        const pnl = p.pnl + p.quantity * (ltp - p.ltp);
        return { ...p, ltp, pnl };
      });
    });
  }, []);

  const handleLtpBatch = useCallback((updates: Array<{ instrumentToken: string; ltp: number }>) => {
    setPositions((prev) => {
      if (prev.length === 0) return prev;
      const map = new Map(updates.map((u) => [u.instrumentToken, u.ltp]));
      return prev.map((p) => {
        const ltp = map.get(p.instrumentToken);
        if (ltp === undefined) return p;
        const pnl = p.pnl + p.quantity * (ltp - p.ltp);
        return { ...p, ltp, pnl };
      });
    });
  }, []);

  const { isLive } = useSignalrPositions({
    onPositions: handlePositions,
    onLtpBatch: handleLtpBatch,
    onOrderUpdate,
    onFallbackLoad: load,
  });

  return { positions, setPositions, loading, isLive, load };
}
```

- [ ] **Step 4: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/panels/positions-panel/use-signalr-positions.ts \
        frontend/src/components/panels/positions-panel/use-positions-rest-fallback.ts \
        frontend/src/components/panels/positions-panel/use-positions-feed.tsx
git commit -m "refactor: decompose use-positions-feed into signalR + REST + orchestrator"
```

---

### Task 5.2: Decompose use-option-chain.ts

**Files:**
- Create: `frontend/src/components/panels/option-chain-panel/use-option-chain-feed.ts`
- Create: `frontend/src/components/panels/option-chain-panel/use-iv-history.ts`
- Modify: `frontend/src/components/panels/option-chain-panel/use-option-chain.ts`

- [ ] **Step 1: Create use-iv-history.ts**

Extract the IV history `useEffect` (lines 157–167) and its cache ref:

```ts
// frontend/src/components/panels/option-chain-panel/use-iv-history.ts
import { useState, useEffect, useRef } from "react";
import { fetchIvHistory } from "@/services/trading-api";
import type { IvSnapshot } from "@/types";

export function useIvHistory(underlying: string) {
  const [ivHistory, setIvHistory] = useState<IvSnapshot[]>([]);
  const cache = useRef<Record<string, IvSnapshot[]>>({});

  useEffect(() => {
    if (!underlying) return;
    const cached = cache.current[underlying];
    if (cached) { setIvHistory(cached); return; }
    fetchIvHistory(underlying)
      .then((data) => {
        cache.current[underlying] = data;
        setIvHistory(data);
      })
      .catch(() => {});
  }, [underlying]);

  return ivHistory;
}
```

- [ ] **Step 2: Create use-option-chain-feed.ts**

Extract the SignalR `useEffect` (lines 105–149) and `liveTokensRef`:

```ts
// frontend/src/components/panels/option-chain-panel/use-option-chain-feed.ts
import { useEffect, useRef } from "react";
import * as signalR from "@microsoft/signalr";
import { API_BASE_URL } from "@/lib/constants";
import type { OptionChainEntry } from "@/types";

interface UseOptionChainFeedOptions {
  onLtpBatch: (updates: Array<{ instrumentToken: string; ltp: number }>) => void;
  subscribeTokens: (tokens: string[]) => void;
}

export function useOptionChainFeed({ onLtpBatch, subscribeTokens }: UseOptionChainFeedOptions) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const liveTokensRef = useRef<string[]>([]);

  const setLiveTokens = (tokens: string[]) => {
    liveTokensRef.current = tokens;
  };

  const invokeSubscribe = (tokens: string[]) => {
    const conn = connectionRef.current;
    if (conn?.state !== signalR.HubConnectionState.Connected) return;
    conn.invoke("ClearSubscriptions").catch(() => {});
    if (tokens.length > 0) conn.invoke("SubscribeToInstruments", tokens).catch(() => {});
  };

  useEffect(() => {
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/option-chain`)
      .withAutomaticReconnect()
      .build();

    conn.on("ReceiveLtpBatch", onLtpBatch);

    conn.onreconnected(() => {
      const tokens = liveTokensRef.current;
      if (tokens.length > 0) conn.invoke("SubscribeToInstruments", tokens).catch(() => {});
    });

    connectionRef.current = conn;
    conn.start().catch(() => {});

    return () => {
      conn.invoke("ClearSubscriptions").catch(() => {});
      conn.stop();
      connectionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { setLiveTokens, invokeSubscribe };
}
```

- [ ] **Step 3: Modify use-option-chain.ts to remove extracted concerns**

In `use-option-chain.ts`:

1. Replace the `ivHistoryCache` ref and IV history `useEffect` with:
```ts
import { useIvHistory } from "./use-iv-history";
// ...
const ivHistory = useIvHistory(underlying);
```

2. Replace the SignalR `useEffect` and `connectionRef`/`liveTokensRef` with:
```ts
import { useOptionChainFeed } from "./use-option-chain-feed";
// ...
const handleLtpBatch = useCallback((updates: Array<{ instrumentToken: string; ltp: number }>) => {
  // copy the ReceiveLtpBatch handler body (map + setAllChain) from lines 111–131
}, []);

const { setLiveTokens, invokeSubscribe } = useOptionChainFeed({
  onLtpBatch: handleLtpBatch,
  subscribeTokens: () => {},
});
```

3. In `subscribeLiveTokens`, replace `connectionRef.current` / `liveTokensRef.current` usages with `invokeSubscribe` / `setLiveTokens`:
```ts
const subscribeLiveTokens = useCallback((chain: OptionChainEntry[], liveSet: Set<number>) => {
  const tokens: string[] = [];
  for (const entry of chain) {
    if (!liveSet.has(entry.strikePrice)) continue;
    if (entry.callOptions?.instrumentKey) tokens.push(entry.callOptions.instrumentKey);
    if (entry.putOptions?.instrumentKey) tokens.push(entry.putOptions.instrumentKey);
  }
  setLiveTokens(tokens);
  invokeSubscribe(tokens);
}, [setLiveTokens, invokeSubscribe]);
```

- [ ] **Step 4: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/panels/option-chain-panel/use-option-chain-feed.ts \
        frontend/src/components/panels/option-chain-panel/use-iv-history.ts \
        frontend/src/components/panels/option-chain-panel/use-option-chain.ts
git commit -m "refactor: decompose use-option-chain — iv-history + feed into single-concern hooks"
```

---

## Cluster 6 — Zustand Store Cleanup

**No changes.** `risk-state-store.ts` is consumed by `use-risk-feed.ts`, `use-profit-protection.ts`, and `logout.ts` — it is genuine cross-component state and must be kept.

---

## Final Verification

- [ ] **Run full build**

```bash
cd frontend && npm run build 2>&1
```
Expected: exit 0 with no TypeScript errors.

- [ ] **Start dev server and do a smoke test**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000` and verify:
- Terminal page loads without errors
- Positions panel renders and filters work
- Quick trade dialog opens (both By Price and By Chain tabs)
- Profit Protection panel opens (lazy loaded — spinner should flash briefly on first open)
- Payoff chart opens from stats bar (lazy loaded)
- No console errors

- [ ] **Final commit**

```bash
git add -A
git commit -m "refactor: frontend React refactor complete — all 6 clusters"
```
