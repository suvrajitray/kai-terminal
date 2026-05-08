# Strategy Quick-Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible strategy strip to the basket dialog that auto-populates the basket with legs for Straddle, Strangle, or Iron Condor in one click.

**Architecture:** A new `StrategyStrip` component uses `useIndicesFeed` for live spot prices (already used by the option chain panel — same SignalR hub) and `useOptionContractsStore` for strike lists. A pure `computeLegs` function takes underlying/expiry/strategy/widths and returns the correct `BasketItem` fields. The basket dialog gets a toggle button in the header that shows/hides the strip above the item table.

**Tech Stack:** React, TypeScript, Zustand (basket + option-contracts stores), Tailwind CSS, shadcn/ui conventions.

---

## File Map

| File | Action |
|------|--------|
| `src/components/layout/basket-dialog/strategy-strip.tsx` | Create — full strip component |
| `src/components/layout/basket-dialog/index.tsx` | Modify — add toggle button + render strip |

No store changes needed — `useIndicesFeed` already provides live index LTPs.

---

## Key Types & Imports Reference

```ts
// ContractEntry (from @/types):
interface ContractEntry {
  expiry: string;          // "2026-05-08"
  instrumentType: "CE" | "PE";
  upstoxToken: string;     // "NSE_FO|37590"
  zerodhaToken: string;    // trading symbol e.g. "NIFTY2641320700PE"
  strikePrice: number;
  lotSize: number;
  exchangeToken: string;
}

// BasketItem (from @/stores/basket-store):
interface BasketItem {
  id: string;
  instrumentKey: string;   // = upstoxToken
  displayName: string;     // "NIFTY 24500 CE"
  exchange: string;        // "NFO" or "BFO"
  side: "CE" | "PE";
  underlying: string;
  strike: number;
  expiry?: string;
  ltp: number;
  lotSize: number;
  transactionType: "Buy" | "Sell";
  orderType: "Market" | "Limit";
  product: "Intraday" | "Delivery";
  qty: number;             // in lots
  limitPrice: string;
}

// IndexPrices (from @/hooks/use-indices-feed):
interface IndexPrices {
  nifty: { ltp: number | null; ... };
  bankNifty: { ltp: number | null; ... };
  sensex: { ltp: number | null; ... };
  finNifty: { ltp: number | null; ... };
  bankex: { ltp: number | null; ... };
}

// INSTRUMENTS (from @/lib/lot-sizes): ["NIFTY", "BANKNIFTY", "SENSEX", "FINNIFTY", "BANKEX"]
// getLotSize(underlying) returns lot size for that underlying
// formatExpiryLabel("2026-05-08") → "08 MAY 26"  (from @/stores/option-contracts-store)
```

---

## Task 1: `strategy-strip.tsx` — full component

**Files:**
- Create: `src/components/layout/basket-dialog/strategy-strip.tsx`

- [ ] **Step 1: Create the file with all imports, types, and the `computeLegs` pure function**

```tsx
// src/components/layout/basket-dialog/strategy-strip.tsx
import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useIndicesFeed } from "@/hooks/use-indices-feed";
import { useOptionContractsStore, formatExpiryLabel } from "@/stores/option-contracts-store";
import { useBasketStore } from "@/stores/basket-store";
import { getLotSize, INSTRUMENTS } from "@/lib/lot-sizes";
import type { ContractEntry } from "@/types";

type Strategy = "Straddle" | "Strangle" | "IronCondor";

const UNDERLYING_TO_INDEX: Record<string, "nifty" | "bankNifty" | "sensex" | "finNifty" | "bankex"> = {
  NIFTY:     "nifty",
  BANKNIFTY: "bankNifty",
  SENSEX:    "sensex",
  FINNIFTY:  "finNifty",
  BANKEX:    "bankex",
};

const BSE_UNDERLYINGS = new Set(["SENSEX", "BANKEX"]);

interface Leg {
  upstoxToken: string;
  strikePrice: number;
  side: "CE" | "PE";
  transactionType: "Buy" | "Sell";
}

function getAtmIndex(strikes: number[], spot: number): number {
  let best = 0;
  for (let i = 1; i < strikes.length; i++) {
    const distI    = Math.abs(strikes[i]    - spot);
    const distBest = Math.abs(strikes[best] - spot);
    // tie-break: prefer the higher strike (standard ATM convention)
    if (distI < distBest || (distI === distBest && strikes[i] > strikes[best])) best = i;
  }
  return best;
}

function computeLegs(
  contracts: ContractEntry[],
  expiry: string,
  spot: number,
  strategy: Strategy,
  sellWidth: number,
  hedgeWidth: number,
): Leg[] | null {
  const ces = contracts
    .filter((c) => c.expiry === expiry && c.instrumentType === "CE")
    .sort((a, b) => a.strikePrice - b.strikePrice);
  const pes = contracts
    .filter((c) => c.expiry === expiry && c.instrumentType === "PE")
    .sort((a, b) => a.strikePrice - b.strikePrice);

  if (ces.length === 0 || pes.length === 0) return null;

  const ceStrikes = ces.map((c) => c.strikePrice);
  const peStrikes = pes.map((c) => c.strikePrice);
  const atmCe = getAtmIndex(ceStrikes, spot);
  const atmPe = getAtmIndex(peStrikes, spot);

  if (strategy === "Straddle") {
    const ce = ces[atmCe];
    const pe = pes[atmPe];
    if (!ce || !pe) return null;
    return [
      { upstoxToken: ce.upstoxToken, strikePrice: ce.strikePrice, side: "CE", transactionType: "Sell" },
      { upstoxToken: pe.upstoxToken, strikePrice: pe.strikePrice, side: "PE", transactionType: "Sell" },
    ];
  }

  if (strategy === "Strangle") {
    const ceIdx = atmCe + sellWidth;
    const peIdx = atmPe - sellWidth;
    if (ceIdx >= ces.length || peIdx < 0) return null;
    return [
      { upstoxToken: ces[ceIdx].upstoxToken, strikePrice: ces[ceIdx].strikePrice, side: "CE", transactionType: "Sell" },
      { upstoxToken: pes[peIdx].upstoxToken, strikePrice: pes[peIdx].strikePrice, side: "PE", transactionType: "Sell" },
    ];
  }

  // IronCondor
  const sellCeIdx = atmCe + sellWidth;
  const buyCeIdx  = sellCeIdx + hedgeWidth;
  const sellPeIdx = atmPe - sellWidth;
  const buyPeIdx  = sellPeIdx - hedgeWidth;
  if (buyCeIdx >= ces.length || buyPeIdx < 0) return null;
  return [
    { upstoxToken: ces[sellCeIdx].upstoxToken, strikePrice: ces[sellCeIdx].strikePrice, side: "CE", transactionType: "Sell" },
    { upstoxToken: ces[buyCeIdx].upstoxToken,  strikePrice: ces[buyCeIdx].strikePrice,  side: "CE", transactionType: "Buy"  },
    { upstoxToken: pes[sellPeIdx].upstoxToken, strikePrice: pes[sellPeIdx].strikePrice, side: "PE", transactionType: "Sell" },
    { upstoxToken: pes[buyPeIdx].upstoxToken,  strikePrice: pes[buyPeIdx].strikePrice,  side: "PE", transactionType: "Buy"  },
  ];
}
```

- [ ] **Step 2: Add the `StrategyStrip` component to the same file**

Append this to `strategy-strip.tsx`:

```tsx
export function StrategyStrip() {
  const indexPrices  = useIndicesFeed();
  const getContracts = useOptionContractsStore((s) => s.getContracts);
  const getExpiries  = useOptionContractsStore((s) => s.getExpiries);
  const addItem      = useBasketStore((s) => s.addItem);

  const [underlying, setUnderlying] = useState<string>(INSTRUMENTS[0]);
  const [expiry, setExpiry]         = useState<string>("");
  const [strategy, setStrategy]     = useState<Strategy>("Straddle");
  const [lots, setLots]             = useState(1);
  const [sellWidth, setSellWidth]   = useState(2);
  const [hedgeWidth, setHedgeWidth] = useState(2);

  // Reset expiry when underlying changes
  useEffect(() => {
    const exps = getExpiries(underlying);
    setExpiry((prev) => (exps.includes(prev) ? prev : (exps[0] ?? "")));
  }, [underlying, getExpiries]);

  const indexKey = UNDERLYING_TO_INDEX[underlying];
  const spot     = indexKey ? (indexPrices[indexKey]?.ltp ?? 0) : 0;
  const contracts = getContracts(underlying);
  const expiries  = getExpiries(underlying);
  const exchange  = BSE_UNDERLYINGS.has(underlying) ? "BFO" : "NFO";
  const lotSize   = getLotSize(underlying);

  const legs = useMemo(
    () => (expiry && spot > 0 ? computeLegs(contracts, expiry, spot, strategy, sellWidth, hedgeWidth) : null),
    [contracts, expiry, spot, strategy, sellWidth, hedgeWidth],
  );

  const canAdd = legs !== null && legs.length > 0;

  function handleAdd() {
    if (!legs) return;
    for (const leg of legs) {
      addItem({
        instrumentKey: leg.upstoxToken,
        displayName: `${underlying} ${leg.strikePrice} ${leg.side}`,
        exchange,
        side: leg.side,
        underlying,
        strike: leg.strikePrice,
        expiry,
        ltp: 0,
        lotSize,
        transactionType: leg.transactionType,
        orderType: "Market",
        product: "Intraday",
        qty: lots,
        limitPrice: "",
      });
    }
  }

  const strategyButtons: { id: Strategy; label: string }[] = [
    { id: "Straddle",   label: "Straddle"    },
    { id: "Strangle",   label: "Strangle"    },
    { id: "IronCondor", label: "Iron Condor" },
  ];

  const strategyActiveClass: Record<Strategy, string> = {
    Straddle:   "bg-blue-900/50 text-blue-300 border-blue-700/50",
    Strangle:   "bg-violet-900/50 text-violet-300 border-violet-700/50",
    IronCondor: "bg-rose-900/50 text-rose-300 border-rose-700/50",
  };

  const disabledReason =
    !expiry           ? "No expiry available for this underlying" :
    spot <= 0         ? "Open the option chain for this underlying to get a live spot price" :
    legs === null     ? "Width exceeds available strikes — reduce OTM width" :
    null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-emerald-900/40 bg-emerald-950/20 px-4 py-2.5">
      {/* Label */}
      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 shrink-0">
        ⚡ Strategy
      </span>

      <div className="w-px h-4 bg-emerald-900/40 shrink-0" />

      {/* Underlying */}
      <select
        value={underlying}
        onChange={(e) => setUnderlying(e.target.value)}
        className="h-7 rounded border border-border/50 bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      >
        {INSTRUMENTS.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>

      {/* Expiry */}
      <select
        value={expiry}
        onChange={(e) => setExpiry(e.target.value)}
        disabled={expiries.length === 0}
        className="h-7 rounded border border-border/50 bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-40"
      >
        {expiries.map((exp) => (
          <option key={exp} value={exp}>{formatExpiryLabel(exp)}</option>
        ))}
      </select>

      <div className="w-px h-4 bg-border/40 shrink-0" />

      {/* Strategy pills */}
      <div className="flex gap-1">
        {strategyButtons.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setStrategy(id)}
            className={cn(
              "h-7 rounded border px-3 text-[10px] font-bold transition-colors",
              strategy === id
                ? strategyActiveClass[id]
                : "border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/30",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-border/40 shrink-0" />

      {/* Width controls — shown for Strangle and Iron Condor */}
      {(strategy === "Strangle" || strategy === "IronCondor") && (
        <>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground shrink-0">
              {strategy === "IronCondor" ? "Sell" : "OTM width"}
            </span>
            <input
              type="number"
              min={1}
              value={sellWidth}
              onChange={(e) => setSellWidth(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="h-7 w-10 rounded border border-border/50 bg-background text-center text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <span className="text-[10px] text-muted-foreground/60 shrink-0">strikes</span>
          </div>
        </>
      )}

      {strategy === "IronCondor" && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground shrink-0">Hedge</span>
          <input
            type="number"
            min={1}
            value={hedgeWidth}
            onChange={(e) => setHedgeWidth(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="h-7 w-10 rounded border border-border/50 bg-background text-center text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <span className="text-[10px] text-muted-foreground/60 shrink-0">more</span>
        </div>
      )}

      {(strategy === "Strangle" || strategy === "IronCondor") && (
        <div className="w-px h-4 bg-border/40 shrink-0" />
      )}

      {/* Lots */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground shrink-0">Lots</span>
        <input
          type="number"
          min={1}
          value={lots}
          onChange={(e) => setLots(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="h-7 w-10 rounded border border-border/50 bg-background text-center text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      <div className="w-px h-4 bg-border/40 shrink-0" />

      {/* Leg preview tags */}
      {canAdd && legs && (
        <div className="flex flex-wrap gap-1">
          {legs.map((leg, i) => (
            <span
              key={i}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                leg.transactionType === "Sell" && leg.side === "CE" && "bg-red-900/40 text-red-300",
                leg.transactionType === "Sell" && leg.side === "PE" && "bg-emerald-900/40 text-emerald-300",
                leg.transactionType === "Buy"  && leg.side === "CE" && "bg-indigo-900/40 text-indigo-300",
                leg.transactionType === "Buy"  && leg.side === "PE" && "bg-teal-900/40 text-teal-300",
              )}
            >
              {leg.transactionType === "Sell" ? "S" : "B"} {leg.strikePrice} {leg.side}
            </span>
          ))}
        </div>
      )}

      {/* Add button — pushed to right */}
      <div className="ml-auto">
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          title={disabledReason ?? undefined}
          className="h-7 rounded bg-emerald-700 px-3 text-[11px] font-bold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {canAdd && legs ? `+ Add ${legs.length} legs` : "+ Add legs"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the build compiles with no TypeScript errors**

Run from `frontend/`:
```bash
npm run build 2>&1 | tail -20
```
Expected: no errors related to `strategy-strip.tsx`. (Other pre-existing warnings are fine.)

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/basket-dialog/strategy-strip.tsx
git commit -m "feat: add StrategyStrip component with Straddle/Strangle/Iron Condor leg computation"
```

---

## Task 2: Wire `StrategyStrip` into basket dialog

**Files:**
- Modify: `src/components/layout/basket-dialog/index.tsx`

The basket dialog currently looks like this at the top of the JSX:

```tsx
<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
  <DialogContent className="sm:max-w-[960px] p-0 gap-0 overflow-hidden" showCloseButton={false}>
    <DialogTitle className="sr-only">Basket</DialogTitle>

    {/* Header */}
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
      <div className="flex items-center gap-2">
        <ShoppingCart className="size-4 text-muted-foreground" />
        <span className="font-semibold text-sm">Basket</span>
        <span className="text-xs text-muted-foreground">
          {items.length} / 20 items
        </span>
      </div>
      {items.length > 0 && (
        <button
          onClick={handleClearBasket}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          <CircleX className="size-3.5" />
          Clear basket
        </button>
      )}
    </div>

    {/* Table */}
    ...
```

- [ ] **Step 1: Add the import and `showStrip` state to `index.tsx`**

At the top of the file, add the import:
```tsx
import { StrategyStrip } from "./strategy-strip";
```

Inside `BasketDialog`, after the existing state declarations, add:
```tsx
const [showStrip, setShowStrip] = useState(false);
```

- [ ] **Step 2: Add the "⚡ Strategies" toggle button to the header**

Replace the existing header div:

```tsx
{/* Header */}
<div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
  <div className="flex items-center gap-2">
    <ShoppingCart className="size-4 text-muted-foreground" />
    <span className="font-semibold text-sm">Basket</span>
    <span className="text-xs text-muted-foreground">
      {items.length} / 20 items
    </span>
  </div>
  {items.length > 0 && (
    <button
      onClick={handleClearBasket}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
    >
      <CircleX className="size-3.5" />
      Clear basket
    </button>
  )}
</div>
```

with:

```tsx
{/* Header */}
<div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
  <div className="flex items-center gap-2">
    <ShoppingCart className="size-4 text-muted-foreground" />
    <span className="font-semibold text-sm">Basket</span>
    <span className="text-xs text-muted-foreground">
      {items.length} / 20 items
    </span>
  </div>
  <div className="flex items-center gap-3">
    <button
      onClick={() => setShowStrip((s) => !s)}
      className={cn(
        "flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold transition-colors",
        showStrip
          ? "border-emerald-700/50 bg-emerald-950/40 text-emerald-400"
          : "border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/30",
      )}
    >
      ⚡ Strategies
    </button>
    {items.length > 0 && (
      <button
        onClick={handleClearBasket}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
      >
        <CircleX className="size-3.5" />
        Clear basket
      </button>
    )}
  </div>
</div>
```

- [ ] **Step 3: Render `<StrategyStrip />` between header and table**

After the closing `</div>` of the header section and before the `{/* Table */}` comment, insert:

```tsx
{/* Strategy strip */}
{showStrip && <StrategyStrip />}
```

So the structure becomes:

```tsx
{/* Header */}
<div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
  ...
</div>

{/* Strategy strip */}
{showStrip && <StrategyStrip />}

{/* Table */}
{items.length === 0 ? (
  ...
```

- [ ] **Step 4: Verify the build compiles with no TypeScript errors**

Run from `frontend/`:
```bash
npm run build 2>&1 | tail -20
```
Expected: build succeeds with no new TypeScript errors.

- [ ] **Step 5: Manual smoke test**

1. Start dev server: `npm run dev`
2. Open the app, open the basket dialog.
3. Click "⚡ Strategies" — strip should appear with a green tint below the header.
4. Click it again — strip should collapse.
5. Select NIFTY, pick an expiry, select Straddle — two leg preview tags should appear (only if the option chain is active so spot price > 0; otherwise the button is disabled with a tooltip).
6. Switch to Strangle — OTM width control appears, leg tags show OTM strikes.
7. Switch to Iron Condor — Sell + Hedge width controls appear, 4 leg tags show.
8. Click "+ Add N legs" — verify N rows appear in the basket table with correct strikes, CE/PE, Buy/Sell.
9. Click again on the same strategy — rows should NOT duplicate (existing `addItem` dedup by `instrumentKey` silently skips already-added items).

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/basket-dialog/index.tsx
git commit -m "feat: wire StrategyStrip into basket dialog with toggle button"
```
