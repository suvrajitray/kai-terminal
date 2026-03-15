import { useRef, useEffect } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from "lightweight-charts";
import type { Candle } from "@/services/charts-api";

interface ChartContainerProps {
  candles: Candle[];
  onCrosshair: (candle: Candle | null) => void;
}

function toChartTime(isoStr: string): Time {
  return Math.floor(new Date(isoStr).getTime() / 1000) as Time;
}

function getChartColors() {
  const style = getComputedStyle(document.documentElement);
  const get = (v: string) => style.getPropertyValue(v).trim();
  return {
    background: get("--chart-bg")     || "#ffffff",
    text:       get("--chart-text")   || "#64748b",
    grid:       get("--chart-grid")   || "#f1f5f9",
    upColor:    get("--chart-up")     || "#16a34a",
    downColor:  get("--chart-down")   || "#dc2626",
    border:     get("--chart-border") || "#e2e8f0",
  };
}

export function ChartContainer({ candles, onCrosshair }: ChartContainerProps) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const chartRef        = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef      = useRef<Candle[]>(candles);

  candlesRef.current = candles;

  // Create chart once on mount
  useEffect(() => {
    if (!containerRef.current) return;
    const colors = getChartColors();

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
        fontFamily: "'Inter', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: colors.border, labelBackgroundColor: colors.border },
        horzLine: { color: colors.border, labelBackgroundColor: colors.border },
      },
      rightPriceScale: { borderColor: colors.border },
      timeScale: {
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:         colors.upColor,
      downColor:       colors.downColor,
      borderUpColor:   colors.upColor,
      borderDownColor: colors.downColor,
      wickUpColor:     colors.upColor,
      wickDownColor:   colors.downColor,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat:  { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Crosshair → OHLCV legend
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        onCrosshair(null);
        return;
      }
      const bar = param.seriesData.get(candleSeries) as CandlestickData | undefined;
      if (!bar) { onCrosshair(null); return; }

      const match = candlesRef.current.find(
        (c) => toChartTime(c.timestamp) === (bar.time as number)
      );
      onCrosshair(match ?? null);
    });

    // Responsive resize
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });
    observer.observe(containerRef.current);

    chartRef.current      = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feed data whenever candles change
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candleSeries || !volumeSeries || candles.length === 0) return;

    const colors = getChartColors();

    const bars = candles.map<CandlestickData>((c) => ({
      time:  toChartTime(c.timestamp),
      open:  c.open,
      high:  c.high,
      low:   c.low,
      close: c.close,
    }));

    const vols = candles.map((c) => ({
      time:  toChartTime(c.timestamp),
      value: c.volume,
      color: c.close >= c.open ? `${colors.upColor}80` : `${colors.downColor}80`,
    }));

    candleSeries.setData(bars);
    volumeSeries.setData(vols);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return <div ref={containerRef} className="h-full w-full" />;
}
