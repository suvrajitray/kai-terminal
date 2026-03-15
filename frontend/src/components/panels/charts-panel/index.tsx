import { useState } from "react";
import { BarChart2, Loader2 } from "lucide-react";
import { useChartsStore } from "@/stores/charts-store";
import { useChartData } from "@/hooks/use-chart-data";
import type { Candle } from "@/services/charts-api";
import { ChartContainer } from "./chart-container";
import { OhlcvLegend } from "./ohlcv-legend";
import { TimeframeSwitcher } from "./timeframe-switcher";
import { InstrumentSearch } from "./instrument-search";
import { IndexQuickPick } from "./index-quick-pick";

export function ChartsPanel() {
  const { selectedInstrument, selectedInterval, setInstrument, setInterval } = useChartsStore();
  const { candles, loading } = useChartData(
    selectedInstrument?.instrumentKey ?? null,
    selectedInterval
  );
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

  const displayCandle = hoveredCandle ?? (candles.length > 0 ? candles[candles.length - 1] : null);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border/40 px-3 py-2">
        <IndexQuickPick selected={selectedInstrument} onSelect={setInstrument} />
        <div className="h-6 w-px bg-border/40" />
        <InstrumentSearch selected={selectedInstrument} onSelect={setInstrument} />
        <div className="h-6 w-px bg-border/40" />
        <TimeframeSwitcher value={selectedInterval} onChange={setInterval} />
        {loading && (
          <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Chart area */}
      {!selectedInstrument ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <BarChart2 className="h-12 w-12 opacity-20" />
          <p className="text-sm">Search for an instrument to view its chart</p>
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          {displayCandle && (
            <div className="absolute left-2 top-2 z-10">
              <OhlcvLegend
                candle={displayCandle}
                symbol={selectedInstrument.tradingSymbol}
              />
            </div>
          )}
          <ChartContainer candles={candles} onCrosshair={setHoveredCandle} />
        </div>
      )}
    </div>
  );
}
