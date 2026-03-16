import { motion } from "motion/react";
import { BrainCircuit, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAiSignals } from "@/hooks/use-ai-signals";
import { useBrokerStore } from "@/stores/broker-store";
import { SentimentCard } from "@/components/ai-signals/sentiment-card";
import { MarketContextBar } from "@/components/ai-signals/market-context-bar";
import type { AiModelResult } from "@/services/ai-signals-api";

const MODELS: AiModelResult[] = [
  { model: "GPT-4o", provider: "openai",     direction: null, confidence: null, reasons: [], support: null, resistance: null, watchFor: null, error: null, latencyMs: 0 },
  { model: "Grok",   provider: "xai",        direction: null, confidence: null, reasons: [], support: null, resistance: null, watchFor: null, error: null, latencyMs: 0 },
  { model: "Gemini", provider: "google",     direction: null, confidence: null, reasons: [], support: null, resistance: null, watchFor: null, error: null, latencyMs: 0 },
  { model: "Claude", provider: "anthropic",  direction: null, confidence: null, reasons: [], support: null, resistance: null, watchFor: null, error: null, latencyMs: 0 },
];

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function AiSignalsPage() {
  const brokerAuthenticated = useBrokerStore((s) => s.isAuthenticated("upstox"));
  const { data, loading, error, lastUpdated, secondsUntilRefresh, refresh } = useAiSignals();

  if (!brokerAuthenticated) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <WifiOff className="size-10 text-muted-foreground/40" />
        <p className="text-muted-foreground">Connect a broker to use AI Signals.</p>
      </div>
    );
  }

  const cards = data?.models ?? MODELS;

  return (
    <div className="space-y-6 p-1">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-start justify-between gap-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BrainCircuit className="size-5 text-primary" />
            <h1 className="text-xl font-semibold">AI Market Signals</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Consulting AI models…"
              : lastUpdated
              ? `Last updated ${lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
              : "Not yet loaded"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!loading && data && (
            <span className="text-xs text-muted-foreground">
              Next refresh in{" "}
              <span className={cn("font-medium tabular-nums", secondsUntilRefresh < 60 ? "text-amber-400" : "text-foreground")}>
                {formatCountdown(secondsUntilRefresh)}
              </span>
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Error banner */}
      {error && !loading && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Market context bar */}
      {data && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <MarketContextBar data={data} />
        </motion.div>
      )}

      {/* AI model cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((result, i) => (
          <motion.div
            key={result.model}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.05 }}
          >
            <SentimentCard result={result} loading={loading} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
