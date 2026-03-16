import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useIndicesFeed, type IndexQuote, type IndexPrices } from "@/hooks/use-indices-feed";
import { useUserTradingSettingsStore } from "@/stores/user-trading-settings-store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const FMT = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (v: number | null) => (v !== null ? FMT.format(v) : "—");

const ALL_INDICES: { key: keyof IndexPrices; label: string }[] = [
  { key: "nifty",    label: "Nifty" },
  { key: "sensex",   label: "Sensex" },
  { key: "bankNifty", label: "Bank Nifty" },
  { key: "finNifty", label: "Fin Nifty" },
  { key: "bankex",   label: "Bankex" },
];

const DEFAULT_VISIBLE: (keyof IndexPrices)[] = ["nifty", "sensex"];
const STORAGE_KEY = "kai-terminal-visible-indices";

function loadVisible(): (keyof IndexPrices)[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as (keyof IndexPrices)[];
  } catch {}
  return DEFAULT_VISIBLE;
}

function saveVisible(keys: (keyof IndexPrices)[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

function IndexCard({ label, quote }: { label: string; quote: IndexQuote }) {
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

  return (
    <div className="flex items-center gap-2.5">
      {/* Left: label + LTP + change */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">{label}</span>
          <span className="text-[13px] font-bold tabular-nums tracking-tight leading-none">{fmt(quote.ltp)}</span>
        </div>
        {change !== null && changePct !== null ? (
          <span className={cn("text-[10px] tabular-nums font-medium leading-none", isUp ? "text-green-400" : "text-red-400")}>
            {isUp ? "+" : ""}{FMT.format(change)}
            <span className="ml-0.5 text-[9px] opacity-70">({isUp ? "+" : ""}{changePct.toFixed(2)}%)</span>
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/30 leading-none">—</span>
        )}
      </div>

      {/* Right: OHL as vertical mini-column */}
      <div className="flex flex-col gap-px border-l border-border/25 pl-2.5 text-[9px] tabular-nums">
        <span className="flex items-center gap-1 leading-tight">
          <span className="w-2 font-bold text-sky-400/70">O</span>
          <span className="text-muted-foreground/55">{fmt(quote.open)}</span>
        </span>
        <span className="flex items-center gap-1 leading-tight">
          <span className="w-2 font-bold text-green-400/70">H</span>
          <span className="text-muted-foreground/55">{fmt(quote.high)}</span>
        </span>
        <span className="flex items-center gap-1 leading-tight">
          <span className="w-2 font-bold text-red-400/70">L</span>
          <span className="text-muted-foreground/55">{fmt(quote.low)}</span>
        </span>
      </div>
    </div>
  );
}

function IndexPickerPopover({
  visible,
  onChange,
}: {
  visible: (keyof IndexPrices)[];
  onChange: (keys: (keyof IndexPrices)[]) => void;
}) {
  const toggle = (key: keyof IndexPrices) => {
    if (visible.includes(key)) {
      if (visible.length === 1) return; // keep at least one
      onChange(visible.filter((k) => k !== key));
    } else {
      onChange([...visible, key]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
          <SlidersHorizontal className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-2">
        <p className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">Show indices</p>
        <div className="space-y-1">
          {ALL_INDICES.map(({ key, label }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/40"
            >
              <Checkbox
                checked={visible.includes(key)}
                onCheckedChange={() => toggle(key)}
              />
              {label}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function IndexTicker() {
  const [visible, setVisible] = useState<(keyof IndexPrices)[]>(loadVisible);
  const prices = useIndicesFeed();

  const handleChange = (keys: (keyof IndexPrices)[]) => {
    setVisible(keys);
    saveVisible(keys);
  };

  const visibleIndices = ALL_INDICES.filter(({ key }) => visible.includes(key));

  return (
    <div className="hidden items-center gap-3 lg:flex">
      {visibleIndices.map(({ key, label }, i) => (
        <div key={key} className="flex items-center gap-3">
          {i > 0 && <div className="h-8 w-px bg-border/40" />}
          <IndexCard label={label} quote={prices[key]} />
        </div>
      ))}
      <div className="h-8 w-px bg-border/40" />
      <IndexPickerPopover visible={visible} onChange={handleChange} />
    </div>
  );
}
