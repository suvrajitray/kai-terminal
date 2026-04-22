import { useNavigate } from "react-router-dom";
import { Bot, CheckCircle2, Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useAutoEntry } from "@/hooks/use-auto-entry";
import type { AutoEntryStrategy, AutoEntryStatus } from "@/hooks/use-auto-entry";

export function AutoEntryPage() {
  const navigate = useNavigate();
  const { strategies, loading, error, remove, getStatus } = useAutoEntry();

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this strategy?")) return;
    try {
      await remove(id);
      toast.success("Strategy deleted");
    } catch {
      toast.error("Failed to delete strategy");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">Auto Entry</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Automatically sell options once per day within a configured time window.
          </p>
        </div>
        {strategies.length > 0 && (
          <Button onClick={() => navigate("/auto-entry/new")} size="sm">
            <Plus className="mr-1.5 size-4" />
            Add Strategy
          </Button>
        )}
      </div>

      {loading ? (
        <Card className="border-border/40 bg-muted/10">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-border/40 bg-muted/10">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      ) : strategies.length === 0 ? (
        <Card className="border-border/40 bg-muted/10">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-sm text-muted-foreground">No strategies yet.</p>
            <Button onClick={() => navigate("/auto-entry/new")}>
              <Plus className="mr-2 size-4" />
              Add Strategy
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {strategies.map((s) => (
            <StrategyCard
              key={s.id}
              strategy={s}
              status={getStatus(s.id)}
              onEdit={() => navigate(`/auto-entry/${s.id}/edit`)}
              onDelete={() => handleDelete(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StrategyCard({
  strategy,
  status,
  onEdit,
  onDelete,
}: {
  strategy: AutoEntryStrategy;
  status: AutoEntryStatus | undefined;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const brokerLabel = strategy.brokerType === "zerodha" ? "Zerodha" : "Upstox";

  const enteredAt = status?.enteredAtUtc
    ? new Date(status.enteredAtUtc.endsWith("Z") ? status.enteredAtUtc : status.enteredAtUtc + "Z").toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : null;

  const optionTypeColor =
    strategy.optionType === "CE"
      ? "text-red-600 dark:text-red-400"
      : strategy.optionType === "PE"
        ? "text-green-600 dark:text-green-400"
        : "text-primary";

  return (
    <Card className="border-border/40 bg-muted/10">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                strategy.enabled ? "bg-green-500" : "bg-muted-foreground/40"
              )}
            />
            <span className="font-semibold text-sm truncate">{strategy.name}</span>
          </div>
          <span className="shrink-0 rounded-full border border-border/40 bg-muted/20 px-2 py-0.5 text-xs text-muted-foreground">
            {brokerLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-medium tabular-nums">{strategy.instrument}</span>
          <span className="text-muted-foreground">·</span>
          <span className={cn("font-medium", optionTypeColor)}>{strategy.optionType}</span>
        </div>

        <div className="text-sm text-muted-foreground tabular-nums">
          {strategy.lots} {strategy.lots === 1 ? "lot" : "lots"} · {strategy.strikeMode}
        </div>

        <div className="text-sm text-muted-foreground tabular-nums">
          {strategy.entryAfterTime} – {strategy.noEntryAfterTime}
        </div>

        <div className="flex items-center gap-2 text-sm">
          {status?.enteredToday ? (
            <>
              <CheckCircle2 className="size-3.5 text-green-600 dark:text-green-400 shrink-0" />
              <span className="text-green-600 dark:text-green-400">
                Entered today at {enteredAt} IST
              </span>
            </>
          ) : (
            <>
              <Clock className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Not entered today</span>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-1 pt-1">
          <button
            onClick={onEdit}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
            aria-label="Edit strategy"
          >
            <Pencil className="size-4" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            aria-label="Delete strategy"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
