import type { Candle } from "@/services/charts-api";

interface OhlcvLegendProps {
  candle: Candle;
  symbol: string;
}

function formatVolume(v: number): string {
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toString();
}

export function OhlcvLegend({ candle, symbol }: OhlcvLegendProps) {
  const isUp = candle.close >= candle.open;
  const color = isUp ? "text-green-500" : "text-red-500";

  return (
    <div className="flex items-center gap-2.5 rounded-md bg-background/80 px-2 py-1 backdrop-blur-sm text-xs tabular-nums">
      <span className="font-semibold text-foreground">{symbol}</span>
      <span className="text-muted-foreground">
        O <span className={color}>{candle.open.toFixed(2)}</span>
      </span>
      <span className="text-muted-foreground">
        H <span className={color}>{candle.high.toFixed(2)}</span>
      </span>
      <span className="text-muted-foreground">
        L <span className={color}>{candle.low.toFixed(2)}</span>
      </span>
      <span className="text-muted-foreground">
        C <span className={color}>{candle.close.toFixed(2)}</span>
      </span>
      <span className="text-muted-foreground">
        V <span className="text-foreground">{formatVolume(candle.volume)}</span>
      </span>
    </div>
  );
}
