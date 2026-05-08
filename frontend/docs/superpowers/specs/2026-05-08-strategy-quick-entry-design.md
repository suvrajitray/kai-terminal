# Strategy Quick-Entry Design

## Overview

A collapsible strip inside the basket dialog that lets the user pick an underlying + expiry, select a strategy (Straddle / Strangle / Iron Condor), configure width and lots, preview the legs, and add them all to the basket in one click.

## Placement

The strip lives between the basket dialog header and the item table. It is toggled by a "⚡ Strategies" button in the header. Default state: collapsed. When expanded, the strip is always visible above the basket rows.

## Strategies

| Strategy    | Legs | Controls |
|-------------|------|----------|
| Straddle    | Sell ATM CE + Sell ATM PE | Lots only |
| Strangle    | Sell (ATM + W) CE + Sell (ATM − W) PE | OTM width (strikes) + Lots |
| Iron Condor | Sell (ATM+S) CE + Buy (ATM+S+H) CE + Sell (ATM−S) PE + Buy (ATM−S−H) PE | Sell width + Hedge width (strikes) + Lots |

- ATM = strike with price closest to current spot price of the selected underlying.
- All sold legs → `transactionType: "Sell"`. All hedge legs → `transactionType: "Buy"`.
- Default order type for all legs: `"Market"`, product: `"Intraday"`.

## ATM / Spot Price

`useOptionContractsStore` gains:
- `spotPrices: Record<string, number>` — keyed by underlying name (e.g. `"NIFTY"`)
- `setSpotPrice(underlying: string, price: number)` action

The option chain's LTP handler (`use-option-chain.ts`) calls `setSpotPrice` whenever it receives an index LTP tick for the watched underlying.

The strategy strip reads `spotPrices[underlying]` when computing ATM. If no spot price is available, the "Add legs" button is disabled with a tooltip: "Open the option chain for this underlying first."

## Strike Lookup

```
contracts = getContracts(underlying).filter(c => c.expiry === expiry)
ceStrikes = contracts.filter(c => c.instrumentType === "CE").sortBy(strikePrice)
peStrikes = contracts.filter(c => c.instrumentType === "PE").sortBy(strikePrice)
atmIdx    = index of strike closest to spotPrices[underlying]
            // tie-break: pick the higher strike (standard convention)

Straddle:  CE[atmIdx], PE[atmIdx]
Strangle:  CE[atmIdx + sellWidth], PE[atmIdx - sellWidth]
Iron Condor: CE[atmIdx + S], CE[atmIdx + S + H], PE[atmIdx - S], PE[atmIdx - S - H]
```

If an index is out of bounds (e.g. user sets width too large), the button is disabled with "Width exceeds available strikes."

## Supported Underlyings

NIFTY, BANKNIFTY, FINNIFTY (exchange: NFO) · SENSEX, BANKEX (exchange: BFO)

Exchange per leg is set to `"NFO"` for NSE underlyings and `"BFO"` for BSE underlyings, matching the existing `triggerOrder` logic in `option-chain-row.tsx`.

## Component State (local, no store)

```ts
underlying: string          // default: "NIFTY"
expiry: string              // default: first available expiry
strategy: "Straddle" | "Strangle" | "IronCondor"  // default: "Straddle"
lots: number                // default: 1
sellWidth: number           // default: 2  (Strangle + IC)
hedgeWidth: number          // default: 2  (IC only)
```

State resets to defaults each time the basket dialog opens (strip is re-mounted).

## Files

| File | Change |
|------|--------|
| `stores/option-contracts-store.ts` | Add `spotPrices` + `setSpotPrice` |
| `panels/option-chain-panel/use-option-chain.ts` | Call `setSpotPrice` on index LTP |
| `layout/basket-dialog/strategy-strip.tsx` | New — strip UI + leg computation |
| `layout/basket-dialog/index.tsx` | Add `showStrip` toggle + render `<StrategyStrip />` |

## UX Details

- "⚡ Strategies" button in header toggles strip open/closed.
- Expiry dropdown is populated from `getExpiries(underlying)`, re-populated when underlying changes.
- Leg preview tags update live as controls change (underlying, expiry, strategy, widths).
- "Add N legs" button label shows the count (2 for Straddle/Strangle, 4 for IC).
- Duplicate legs (already in basket) are silently skipped per existing `addItem` dedup logic.
- After adding legs, the strip stays open (user may want to add another expiry or strategy).
