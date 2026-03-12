import { useIndicesFeed, type IndexQuote } from "@/hooks/use-indices-feed";

const FMT = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (v: number | null) => (v !== null ? FMT.format(v) : "—");

function IndexCard({ label, quote }: { label: string; quote: IndexQuote }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{fmt(quote.ltp)}</span>
      <span className="text-muted-foreground/60 tabular-nums">
        O {fmt(quote.open)} · H {fmt(quote.high)}
      </span>
    </div>
  );
}

export function IndexTicker() {
  const { nifty, bankNifty, sensex } = useIndicesFeed();

  return (
    <div className="hidden items-center gap-5 lg:flex">
      <IndexCard label="Nifty" quote={nifty} />
      <IndexCard label="Bank Nifty" quote={bankNifty} />
      <IndexCard label="Sensex" quote={sensex} />
    </div>
  );
}
