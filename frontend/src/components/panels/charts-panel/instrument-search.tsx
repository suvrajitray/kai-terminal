import { useState, useRef, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { searchInstruments, type InstrumentSearchResult } from "@/services/charts-api";

interface InstrumentSearchProps {
  selected: InstrumentSearchResult | null;
  onSelect: (result: InstrumentSearchResult) => void;
}

export function InstrumentSearch({ selected, onSelect }: InstrumentSearchProps) {
  const [query, setQuery] = useState(selected?.tradingSymbol ?? "");
  const [results, setResults] = useState<InstrumentSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync label when selected changes externally
  useEffect(() => {
    if (selected) setQuery(selected.tradingSymbol);
  }, [selected]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);

    if (value.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchInstruments(value);
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSelect = (result: InstrumentSearchResult) => {
    setQuery(result.tradingSymbol);
    setOpen(false);
    onSelect(result);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search instruments…"
          className="h-8 w-52 pl-8 pr-8 text-sm"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 w-80 overflow-hidden rounded-md border border-border/60 bg-popover shadow-lg">
          <div className="max-h-64 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.instrumentKey}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(r)}
                className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.tradingSymbol}</div>
                  {r.name && r.name !== r.tradingSymbol && (
                    <div className="truncate text-xs text-muted-foreground">{r.name}</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] px-1 py-0">{r.exchange}</Badge>
                  {r.instrumentType && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">{r.instrumentType}</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
