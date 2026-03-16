import { cn } from "@/lib/utils";
import type { InstrumentSearchResult } from "@/services/charts-api";

const INDICES: InstrumentSearchResult[] = [
  { instrumentKey: "NSE_INDEX|Nifty 50",           tradingSymbol: "Nifty 50",           name: "NIFTY 50",   exchange: "NSE_INDEX", instrumentType: "INDEX" },
  { instrumentKey: "NSE_INDEX|Nifty Bank",          tradingSymbol: "Nifty Bank",          name: "BANK NIFTY", exchange: "NSE_INDEX", instrumentType: "INDEX" },
  { instrumentKey: "NSE_INDEX|Nifty Fin Service",   tradingSymbol: "Nifty Fin Service",   name: "FIN NIFTY",  exchange: "NSE_INDEX", instrumentType: "INDEX" },
  { instrumentKey: "BSE_INDEX|SENSEX",              tradingSymbol: "SENSEX",              name: "BSE SENSEX", exchange: "BSE_INDEX", instrumentType: "INDEX" },
  { instrumentKey: "BSE_INDEX|BANKEX",          tradingSymbol: "BSE-Bankex",          name: "BANKEX",     exchange: "BSE_INDEX", instrumentType: "INDEX" },
];

const DISPLAY_LABEL: Record<string, string> = {
  "NSE_INDEX|Nifty 50":          "Nifty",
  "NSE_INDEX|Nifty Bank":        "BankNifty",
  "NSE_INDEX|Nifty Fin Service": "FinNifty",
  "BSE_INDEX|SENSEX":            "Sensex",
  "BSE_INDEX|BANKEX":        "Bankex",
};

interface IndexQuickPickProps {
  selected: InstrumentSearchResult | null;
  onSelect: (instrument: InstrumentSearchResult) => void;
}

export function IndexQuickPick({ selected, onSelect }: IndexQuickPickProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-muted/30 p-0.5">
      {INDICES.map((idx) => (
        <button
          key={idx.instrumentKey}
          onClick={() => onSelect(idx)}
          className={cn(
            "cursor-pointer rounded px-2 py-1 text-xs font-medium transition-colors",
            selected?.instrumentKey === idx.instrumentKey
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {DISPLAY_LABEL[idx.instrumentKey] ?? idx.name}
        </button>
      ))}
    </div>
  );
}
