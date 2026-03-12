import { useIndicesFeed, type IndexQuote } from "@/hooks/use-indices-feed";

const FMT = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (v: number | null) => (v !== null ? FMT.format(v) : "—");

function IndexCard({ label, quote }: { label: string; quote: IndexQuote }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{fmt(quote.ltp)}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground/50">
        <span>O {fmt(quote.open)}</span>
        <span>H {fmt(quote.high)}</span>
      </div>
    </div>
  );
}

export function IndexTicker() {
  const { nifty, bankNifty, sensex } = useIndicesFeed();

  return (
    <div className="hidden items-center gap-1 lg:flex">
      <IndexCard label="Nifty" quote={nifty} />
      <span className="mx-2 text-border select-none">|</span>
      <IndexCard label="Bank Nifty" quote={bankNifty} />
      <span className="mx-2 text-border select-none">|</span>
      <IndexCard label="Sensex" quote={sensex} />
    </div>
  );
}
