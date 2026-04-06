import { motion } from "motion/react";
import { useIndicesFeed, type IndexQuote, type IndexPrices } from "@/hooks/use-indices-feed";
import { useUserTradingSettingsStore } from "@/stores/user-trading-settings-store";
import { cn } from "@/lib/utils";

const FMT = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (v: number | null) => (v !== null ? FMT.format(v) : "—");

const ALL_INDICES: { key: keyof IndexPrices; label: string }[] = [
  { key: "nifty",     label: "NIFTY" },
  { key: "sensex",    label: "SENSEX" },
  { key: "bankNifty", label: "BANKNIFTY" },
  { key: "finNifty",  label: "FINNIFTY" },
  { key: "bankex",    label: "BANKEX" },
];

function IndexCard({ label, quote, delay }: { label: string; quote: IndexQuote; delay: number }) {
  const indexChangeMode = useUserTradingSettingsStore((s) => s.indexChangeMode);

  let change: number | null;
  let changePct: number | null;

  if (indexChangeMode === "prevClose") {
    change = quote.netChange;
    const prevClose = quote.ltp !== null && quote.netChange !== null ? quote.ltp - quote.netChange : null;
    changePct = change !== null && prevClose ? (change / prevClose) * 100 : null;
  } else {
    change = quote.ltp !== null && quote.open !== null ? quote.ltp - quote.open : null;
    changePct = change !== null && quote.open ? (change / quote.open) * 100 : null;
  }

  const isUp = change !== null && change >= 0;
  const hasData = quote.ltp !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/10 px-4 py-3"
    >
      {/* Left: label + LTP + change */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          {label}
        </span>
        <span className="text-base font-bold tabular-nums leading-none">
          {hasData ? fmt(quote.ltp) : <span className="text-muted-foreground/30">—</span>}
        </span>
        {hasData && change !== null && changePct !== null ? (
          <span className={cn("text-[11px] tabular-nums font-medium leading-none", isUp ? "text-emerald-500" : "text-rose-500")}>
            {isUp ? "+" : ""}{FMT.format(change)}
            <span className="ml-1 text-[10px] opacity-70">({isUp ? "+" : ""}{changePct.toFixed(2)}%)</span>
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground/30 leading-none">—</span>
        )}
      </div>

      {/* Right: OHL vertical mini-column */}
      <div className="flex flex-col gap-px border-l border-border/25 pl-3 text-[9px] tabular-nums">
        <span className="flex items-center gap-1 leading-tight">
          <span className="w-2 font-bold text-sky-400/70">O</span>
          <span className="text-muted-foreground/55">{fmt(quote.open)}</span>
        </span>
        <span className="flex items-center gap-1 leading-tight">
          <span className="w-2 font-bold text-emerald-400/70">H</span>
          <span className="text-muted-foreground/55">{fmt(quote.high)}</span>
        </span>
        <span className="flex items-center gap-1 leading-tight">
          <span className="w-2 font-bold text-rose-400/70">L</span>
          <span className="text-muted-foreground/55">{fmt(quote.low)}</span>
        </span>
      </div>
    </motion.div>
  );
}

export function IndexOverview() {
  const prices = useIndicesFeed();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {ALL_INDICES.map(({ key, label }, i) => (
        <IndexCard key={key} label={label} quote={prices[key]} delay={0.1 + i * 0.06} />
      ))}
    </div>
  );
}
