import { useNavigate } from "react-router-dom";
import { Bot, CheckCircle2, Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useAutoEntry } from "@/hooks/use-auto-entry";
import type { AutoEntryStrategy, AutoEntryStatus } from "@/hooks/use-auto-entry";

function fmt12h(t: string) {
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

export function AutoEntryPage() {
  const navigate = useNavigate();
  const { strategies, loading, error, remove, toggle, getStatus } = useAutoEntry();

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this strategy?")) return;
    try {
      await remove(id);
      toast.success("Strategy deleted");
    } catch {
      toast.error("Failed to delete strategy");
    }
  }

  async function handleToggle(strategy: AutoEntryStrategy) {
    try {
      await toggle(strategy);
    } catch {
      toast.error("Failed to update strategy");
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
              onToggle={() => handleToggle(s)}
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
  onToggle,
}: {
  strategy: AutoEntryStrategy;
  status: AutoEntryStatus | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const brokerLabel = strategy.brokerType === "zerodha" ? "Zerodha" : "Upstox";

  const enteredAt = status?.enteredAtUtc
    ? new Date(status.enteredAtUtc.endsWith("Z") ? status.enteredAtUtc : status.enteredAtUtc + "Z").toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : null;

  const optionColor =
    strategy.optionType === "CE" ? "text-red-400"
    : strategy.optionType === "PE" ? "text-green-400"
    : "text-indigo-400";

  const strikeLabel =
    strategy.strikeMode === "ATM"     ? "ATM"
    : strategy.strikeMode === "OTM"   ? `OTM +${strategy.strikeParam}`
    : strategy.strikeMode === "Delta" ? `Δ ${strategy.strikeParam.toFixed(2)}`
    : `₹${strategy.strikeParam}`;

  const daysLabel =
    strategy.onlyExpiryDay          ? "Expiry only"
    : strategy.tradingDays.length === 5 ? "Mon – Fri"
    : strategy.tradingDays.join(", ") || "—";

  const expiryLabel =
    strategy.expiryOffset === 0 ? "Nearest" : `+${strategy.expiryOffset} expiry`;

  return (
    <Card className={cn(
      "border-border/40 bg-muted/10 transition-colors",
      strategy.enabled ? "border-border/40" : "opacity-60"
    )}>
      <CardContent className="p-4 space-y-3">

        {/* Header: name + toggle + broker */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className={cn(
              "size-2 shrink-0 rounded-full mt-0.5",
              strategy.enabled ? "bg-green-500" : "bg-muted-foreground/40"
            )} />
            <span className="font-semibold text-sm truncate">{strategy.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={strategy.enabled}
              onCheckedChange={onToggle}
              className="scale-90 data-[state=checked]:bg-green-500"
            />
            <span className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-medium",
              strategy.brokerType === "zerodha"
                ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                : "border-violet-500/30 bg-violet-500/10 text-violet-400"
            )}>
              {brokerLabel}
            </span>
          </div>
        </div>

        {/* Strategy summary */}
        <div className="rounded-lg border border-border/30 bg-background/40 px-3 py-2.5 space-y-1.5">
          {/* Row 1: Instrument + Option */}
          <div className="grid grid-cols-2 gap-x-3">
            <SummaryRow label="Instrument" value={strategy.instrument} />
            <SummaryRow label="Option" value={strategy.optionType} valueClass={optionColor} />
          </div>
          {/* Row 2: Quantity + Strike */}
          <div className="grid grid-cols-2 gap-x-3">
            <SummaryRow label="Quantity" value={`${strategy.lots} lot${strategy.lots !== 1 ? "s" : ""}`} />
            <SummaryRow label="Strike" value={strikeLabel} />
          </div>
          {/* Row 3: Window (full width) */}
          <SummaryRow
            label="Window"
            value={`${fmt12h(strategy.entryAfterTime)} – ${fmt12h(strategy.noEntryAfterTime)} IST`}
          />
          {/* Row 4: Days + Expiry */}
          <div className="grid grid-cols-2 gap-x-3">
            <SummaryRow label="Days" value={daysLabel} />
            <SummaryRow label="Expiry" value={expiryLabel} />
          </div>

          {/* Expiry day modifier pill */}
          {(strategy.onlyExpiryDay || strategy.excludeExpiryDay) && (
            <div className="pt-0.5">
              {strategy.onlyExpiryDay ? (
                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  Expiry
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-400">
                  Non-Expiry
                </span>
              )}
            </div>
          )}
        </div>

        {/* Entry status */}
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

        {/* Actions */}
        <div className="flex items-center justify-end gap-1 pt-0.5">
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

function SummaryRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[11px] text-muted-foreground/70 shrink-0">{label}</span>
      <span className="flex-1 border-b border-dotted border-muted-foreground/20 mb-[3px]" />
      <span className={cn("text-[11px] font-medium tabular-nums text-right shrink-0", valueClass ?? "text-foreground/80")}>
        {value}
      </span>
    </div>
  );
}
