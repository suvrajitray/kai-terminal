import { AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { DirectionBadge } from "./direction-badge";
import type { AiModelResult } from "@/services/ai-signals-api";

interface SentimentCardProps {
  result: AiModelResult;
  loading?: boolean;
}

const MODEL_ACCENT: Record<string, string> = {
  "GPT-4o": "border-emerald-500/40",
  "Grok":   "border-gray-400/40",
  "Gemini": "border-blue-500/40",
  "Claude": "border-orange-400/40",
};

const MODEL_LABEL_COLOR: Record<string, string> = {
  "GPT-4o": "text-emerald-400",
  "Grok":   "text-gray-400",
  "Gemini": "text-blue-400",
  "Claude": "text-orange-400",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  "High":   "text-green-400",
  "Medium": "text-amber-400",
  "Low":    "text-red-400",
};

function CardSkeleton({ model }: { model: string }) {
  const accent = MODEL_ACCENT[model] ?? "border-border/40";
  return (
    <div className={cn("rounded-xl border bg-card p-5 flex flex-col gap-3 animate-pulse", accent)}>
      <div className="flex items-center justify-between">
        <div className="h-4 w-16 rounded bg-muted/50" />
        <div className="h-6 w-24 rounded bg-muted/50" />
      </div>
      <div className="h-3 w-12 rounded bg-muted/50" />
      <div className="space-y-2 mt-1">
        <div className="h-3 w-full rounded bg-muted/40" />
        <div className="h-3 w-4/5 rounded bg-muted/40" />
        <div className="h-3 w-3/5 rounded bg-muted/40" />
      </div>
      <div className="mt-auto space-y-1.5">
        <div className="h-3 w-2/3 rounded bg-muted/40" />
        <div className="h-3 w-2/3 rounded bg-muted/40" />
      </div>
    </div>
  );
}

export function SentimentCard({ result, loading }: SentimentCardProps) {
  if (loading) return <CardSkeleton model={result.model} />;

  const accent     = MODEL_ACCENT[result.model]      ?? "border-border/40";
  const labelColor = MODEL_LABEL_COLOR[result.model] ?? "text-muted-foreground";
  const confColor  = result.confidence ? (CONFIDENCE_STYLES[result.confidence] ?? "text-muted-foreground") : "";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 flex flex-col gap-3 transition-all",
        accent,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <span className={cn("text-sm font-semibold", labelColor)}>{result.model}</span>
        {result.error ? (
          <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
        ) : (
          <DirectionBadge direction={result.direction} />
        )}
      </div>

      {/* Error state */}
      {result.error ? (
        <p className="text-xs text-red-400 leading-relaxed">{result.error}</p>
      ) : (
        <>
          {/* Confidence */}
          {result.confidence && (
            <span className={cn("text-xs font-medium", confColor)}>
              {result.confidence} confidence
            </span>
          )}

          {/* Reasons */}
          {result.reasons.length > 0 && (
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {result.reasons.map((r, i) => (
                <li key={i} className="flex gap-1.5 leading-relaxed">
                  <span className="text-border shrink-0">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Support / Resistance */}
          <div className="mt-auto space-y-1 rounded-md bg-muted/20 px-3 py-2">
            {result.support !== null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Support</span>
                <span className="font-medium tabular-nums text-green-400">
                  {result.support.toLocaleString("en-IN")}
                </span>
              </div>
            )}
            {result.resistance !== null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Resistance</span>
                <span className="font-medium tabular-nums text-red-400">
                  {result.resistance.toLocaleString("en-IN")}
                </span>
              </div>
            )}
          </div>

          {/* Watch for */}
          {result.watchFor && (
            <p className="text-xs text-muted-foreground italic leading-relaxed border-t border-border/30 pt-2">
              {result.watchFor}
            </p>
          )}
        </>
      )}

      {/* Latency */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
        <Clock className="size-2.5" />
        <span>{(result.latencyMs / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}
