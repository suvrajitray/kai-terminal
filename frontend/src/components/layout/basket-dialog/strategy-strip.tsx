// src/components/layout/basket-dialog/strategy-strip.tsx
import { useState, useMemo, useEffect } from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIndicesFeed } from "@/hooks/use-indices-feed";
import { useOptionContractsStore, formatExpiryLabel } from "@/stores/option-contracts-store";
import { useBasketStore } from "@/stores/basket-store";
import { getLotSize, INSTRUMENTS } from "@/lib/lot-sizes";
import { toast } from "@/lib/toast";
import { UNDERLYING_TO_INDEX } from "@/lib/constants";
import { computeLegs, type Strategy } from "@/lib/strategy-utils";

const BSE_UNDERLYINGS = new Set(["SENSEX", "BANKEX"]);

const STRATEGY_BUTTONS: { id: Strategy; label: string }[] = [
  { id: "Straddle",   label: "Straddle"    },
  { id: "Strangle",   label: "Strangle"    },
  { id: "IronCondor", label: "Iron Condor" },
];

const STRATEGY_ACTIVE_CLASS: Record<Strategy, string> = {
  Straddle:   "bg-blue-900/50 text-blue-300 border-blue-700/50",
  Strangle:   "bg-violet-900/50 text-violet-300 border-violet-700/50",
  IronCondor: "bg-rose-900/50 text-rose-300 border-rose-700/50",
};


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

  const hasUpstoxContracts = contracts.some((c) => c.upstoxToken !== "");

  const canAdd = legs !== null && legs.length > 0;

  function handleAdd() {
    if (!legs) return;
    const currentCount = useBasketStore.getState().items.length;
    if (currentCount + legs.length > 20) {
      toast.error(`Not enough room — need ${legs.length} slots, only ${20 - currentCount} available`);
      return;
    }
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

  const disabledReason =
    !expiry              ? "No expiry available for this underlying" :
    spot <= 0            ? "No live spot price available" :
    !hasUpstoxContracts  ? "Strategy quick-entry requires an Upstox session" :
    legs === null        ? "Width exceeds available strikes — reduce OTM width" :
    null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-emerald-900/40 bg-emerald-950/20 px-4 py-2.5">
      {/* Label */}
      <div className="flex items-center gap-1 text-emerald-500 shrink-0">
        <Zap className="size-3" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Strategy</span>
      </div>

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
        {STRATEGY_BUTTONS.map(({ id, label }) => (
          <button
            type="button"
            key={id}
            onClick={() => setStrategy(id)}
            className={cn(
              "h-7 rounded border px-3 text-[10px] font-bold transition-colors",
              strategy === id
                ? STRATEGY_ACTIVE_CLASS[id]
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
          max={99}
          value={lots}
          onChange={(e) => setLots(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))}
          className="h-7 w-10 rounded border border-border/50 bg-background text-center text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {canAdd && legs && <div className="w-px h-4 bg-border/40 shrink-0" />}

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
