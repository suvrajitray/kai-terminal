import { useIndicesFeed, type IndexQuote } from "@/hooks/use-indices-feed";
import { cn } from "@/lib/utils";

const FMT = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (v: number | null) => (v !== null ? FMT.format(v) : "—");

function OhlcBadge({ label, value, className }: { label: string; value: number | null; className?: string }) {
  return (
    <span className="flex items-center gap-0.5">
      <span className={cn("text-[9px] font-semibold uppercase tracking-wide", className)}>{label}</span>
      <span className="text-[10px] tabular-nums text-foreground/70">{fmt(value)}</span>
    </span>
  );
}

function IndexCard({ label, quote }: { label: string; quote: IndexQuote }) {
  const change = quote.ltp !== null && quote.open !== null ? quote.ltp - quote.open : null;
  const changePct = change !== null && quote.open ? (change / quote.open) * 100 : null;
  const isUp = change !== null && change >= 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="text-sm font-bold tabular-nums tracking-tight">{fmt(quote.ltp)}</span>
        {change !== null && changePct !== null && (
          <span className={cn(
            "text-[10px] tabular-nums font-medium",
            isUp ? "text-green-400" : "text-red-400"
          )}>
            {isUp ? "+" : ""}{FMT.format(change)}
            <span className="ml-0.5 text-[9px] opacity-80">
              ({isUp ? "+" : ""}{changePct.toFixed(2)}%)
            </span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 rounded-sm bg-muted/30 px-1.5 py-0.5">
        <OhlcBadge label="O" value={quote.open}  className="text-sky-400/70" />
        <span className="text-border/60">·</span>
        <OhlcBadge label="H" value={quote.high} className="text-green-400/70" />
        <span className="text-border/60">·</span>
        <OhlcBadge label="L" value={quote.low}  className="text-red-400/70" />
      </div>
    </div>
  );
}

export function IndexTicker() {
  const { nifty, bankNifty, sensex } = useIndicesFeed();

  return (
    <div className="hidden items-center gap-3 lg:flex">
      <IndexCard label="Nifty" quote={nifty} />
      <div className="h-8 w-px bg-border/40" />
      <IndexCard label="Bank Nifty" quote={bankNifty} />
      <div className="h-8 w-px bg-border/40" />
      <IndexCard label="Sensex" quote={sensex} />
    </div>
  );
}
