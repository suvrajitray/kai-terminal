import { useState } from "react";
import { Bot, CheckCircle2, Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useBrokerStore } from "@/stores/broker-store";
import { BROKERS } from "@/lib/constants";
import { useShallow } from "zustand/react/shallow";
import { useAutoEntry } from "@/hooks/use-auto-entry";
import type { AutoEntryStrategy, AutoEntryStrategyInput, AutoEntryStatus } from "@/hooks/use-auto-entry";

const INSTRUMENTS  = ["NIFTY", "BANKNIFTY", "SENSEX", "FINNIFTY", "BANKEX"] as const;
const OPTION_TYPES = ["CE", "PE", "CE+PE"] as const;
const TRADING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
const STRIKE_MODES = ["ATM", "OTM", "Delta", "Premium"] as const;

function makeDefault(brokerType: string): AutoEntryStrategyInput {
  return {
    brokerType,
    name: "Morning Sell",
    enabled: true,
    instrument: "NIFTY",
    optionType: "PE",
    lots: 1,
    entryAfterTime: "09:30",
    noEntryAfterTime: "11:30",
    tradingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    excludeExpiryDay: false,
    expiryOffset: 0,
    strikeMode: "ATM",
    strikeParam: 0,
  };
}

function strategyToInput(s: AutoEntryStrategy): AutoEntryStrategyInput {
  return {
    brokerType: s.brokerType,
    name: s.name,
    enabled: s.enabled,
    instrument: s.instrument,
    optionType: s.optionType,
    lots: s.lots,
    entryAfterTime: s.entryAfterTime,
    noEntryAfterTime: s.noEntryAfterTime,
    tradingDays: s.tradingDays,
    excludeExpiryDay: s.excludeExpiryDay,
    expiryOffset: s.expiryOffset,
    strikeMode: s.strikeMode,
    strikeParam: s.strikeParam,
  };
}

export function AutoEntryPage() {
  const connectedBrokers = useBrokerStore(useShallow((s) =>
    BROKERS.filter((b) => s.isAuthenticated(b.id))
  ));

  const { strategies, loading, saving, error, create, update, remove, getStatus } = useAutoEntry();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<AutoEntryStrategyInput>(() =>
    makeDefault(connectedBrokers[0]?.id ?? "upstox")
  );

  function openCreate() {
    setDraft(makeDefault(connectedBrokers[0]?.id ?? "upstox"));
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(strategy: AutoEntryStrategy) {
    setDraft(strategyToInput(strategy));
    setEditingId(strategy.id);
    setDialogOpen(true);
  }

  async function handleSave() {
    try {
      if (editingId !== null) {
        await update(editingId, draft);
        toast.success("Strategy updated");
      } else {
        await create(draft);
        toast.success("Strategy created");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save strategy");
    }
  }

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
    <div className="space-y-6 max-w-2xl">
      <PageHeader />

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
        <EmptyState onAdd={openCreate} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {strategies.map((s) => (
              <StrategyCard
                key={s.id}
                strategy={s}
                status={getStatus(s.id)}
                onEdit={() => openEdit(s)}
                onDelete={() => handleDelete(s.id)}
              />
            ))}
          </div>
          <Button variant="outline" className="w-full border-border/40" onClick={openCreate}>
            <Plus className="mr-2 size-4" />
            Add Strategy
          </Button>
        </>
      )}

      <StrategyDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        draft={draft}
        setDraft={setDraft}
        isNew={editingId === null}
        saving={saving}
        onSave={handleSave}
        connectedBrokers={connectedBrokers}
      />
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Bot className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Auto Entry</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Automatically sell options once per day within a configured time window.
      </p>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <Card className="border-border/40 bg-muted/10">
      <CardContent className="flex flex-col items-center gap-4 py-12">
        <p className="text-sm text-muted-foreground">No strategies yet.</p>
        <Button onClick={onAdd}>
          <Plus className="mr-2 size-4" />
          Add Strategy
        </Button>
      </CardContent>
    </Card>
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
    ? new Date(status.enteredAtUtc).toLocaleTimeString("en-IN", {
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
        {/* Header: name + broker badge + enabled dot */}
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

        {/* Instrument · OptionType */}
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-medium tabular-nums">{strategy.instrument}</span>
          <span className="text-muted-foreground">·</span>
          <span className={cn("font-medium", optionTypeColor)}>{strategy.optionType}</span>
        </div>

        {/* Lots · StrikeMode */}
        <div className="text-sm text-muted-foreground tabular-nums">
          {strategy.lots} {strategy.lots === 1 ? "lot" : "lots"} · {strategy.strikeMode}
        </div>

        {/* Time window */}
        <div className="text-sm text-muted-foreground tabular-nums">
          {strategy.entryAfterTime} – {strategy.noEntryAfterTime}
        </div>

        {/* Status */}
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

        {/* Action buttons */}
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

interface ConnectedBroker {
  id: string;
  name: string;
}

function StrategyDialog({
  open,
  onClose,
  draft,
  setDraft,
  isNew,
  saving,
  onSave,
  connectedBrokers,
}: {
  open: boolean;
  onClose: () => void;
  draft: AutoEntryStrategyInput;
  setDraft: (d: AutoEntryStrategyInput) => void;
  isNew: boolean;
  saving: boolean;
  onSave: () => void;
  connectedBrokers: ConnectedBroker[];
}) {
  function field<K extends keyof AutoEntryStrategyInput>(
    key: K,
    value: AutoEntryStrategyInput[K]
  ) {
    setDraft({ ...draft, [key]: value });
  }

  function toggleDay(day: string) {
    const days = draft.tradingDays.includes(day)
      ? draft.tradingDays.filter((d) => d !== day)
      : [...draft.tradingDays, day];
    field("tradingDays", days);
  }

  const strikeParamLabel =
    draft.strikeMode === "OTM"
      ? "Strikes from ATM"
      : draft.strikeMode === "Delta"
        ? "Target Delta"
        : draft.strikeMode === "Premium"
          ? "Target Premium (₹)"
          : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "New Strategy" : "Edit Strategy"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Enabled toggle */}
          <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/10 px-3 py-2">
            <span className="text-sm font-medium">Enabled</span>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(v) => field("enabled", v)}
            />
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={draft.name}
              onChange={(e) => field("name", e.target.value)}
              className="border-border/40"
              placeholder="Morning Sell"
            />
          </div>

          {/* Broker */}
          {connectedBrokers.length > 0 && (
            <div className="space-y-1.5">
              <Label>Broker</Label>
              <Select
                value={draft.brokerType}
                onValueChange={(v) => field("brokerType", v)}
              >
                <SelectTrigger className="border-border/40 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {connectedBrokers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Instrument */}
          <div className="space-y-1.5">
            <Label>Instrument</Label>
            <Select
              value={draft.instrument}
              onValueChange={(v) => field("instrument", v)}
            >
              <SelectTrigger className="border-border/40 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSTRUMENTS.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Option Type */}
          <div className="space-y-1.5">
            <Label>Option Type</Label>
            <div className="flex gap-1">
              {OPTION_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => field("optionType", t)}
                  className={cn(
                    "flex-1 rounded-md border py-1.5 text-sm font-medium transition-colors",
                    draft.optionType === t
                      ? t === "CE"
                        ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                        : t === "PE"
                          ? "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400"
                          : "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/40 bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Lots */}
          <div className="space-y-1.5">
            <Label>Lots</Label>
            <Input
              type="number"
              min={1}
              value={draft.lots}
              onChange={(e) =>
                field("lots", Math.max(1, parseInt(e.target.value) || 1))
              }
              className="border-border/40 tabular-nums"
            />
          </div>

          {/* Expiry Offset + Skip Expiry Day */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Expiry Offset</Label>
              <Input
                type="number"
                min={0}
                value={draft.expiryOffset}
                onChange={(e) =>
                  field("expiryOffset", Math.max(0, parseInt(e.target.value) || 0))
                }
                className="border-border/40 tabular-nums"
              />
              <p className="text-xs text-muted-foreground">0 = nearest</p>
            </div>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2">
                <Switch
                  id="dialog-exclude-expiry"
                  checked={draft.excludeExpiryDay}
                  onCheckedChange={(v) => field("excludeExpiryDay", v)}
                />
                <Label htmlFor="dialog-exclude-expiry" className="cursor-pointer text-sm">
                  Skip expiry day
                </Label>
              </div>
            </div>
          </div>

          {/* Trading Days */}
          <div className="space-y-1.5">
            <Label>Trading Days</Label>
            <div className="flex gap-1">
              {TRADING_DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "flex-1 rounded-md border py-1.5 text-sm font-medium transition-colors",
                    draft.tradingDays.includes(day)
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/40 bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Time window */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Enter after (IST)</Label>
              <Input
                type="time"
                value={draft.entryAfterTime}
                onChange={(e) => field("entryAfterTime", e.target.value)}
                className="border-border/40 tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label>No entry after (IST)</Label>
              <Input
                type="time"
                value={draft.noEntryAfterTime}
                onChange={(e) => field("noEntryAfterTime", e.target.value)}
                className="border-border/40 tabular-nums"
              />
            </div>
          </div>

          {/* Strike Mode */}
          <div className="space-y-1.5">
            <Label>Strike Mode</Label>
            <div className="flex gap-1">
              {STRIKE_MODES.map((mode) => (
                <button
                  key={mode}
                  onClick={() => field("strikeMode", mode)}
                  className={cn(
                    "flex-1 rounded-md border py-1.5 text-sm font-medium transition-colors",
                    draft.strikeMode === mode
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/40 bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Strike Param (hidden for ATM) */}
          {strikeParamLabel && (
            <div className="space-y-1.5">
              <Label>{strikeParamLabel}</Label>
              <Input
                type="number"
                min={0}
                step={draft.strikeMode === "Delta" ? 0.01 : 1}
                value={draft.strikeParam}
                onChange={(e) =>
                  field("strikeParam", parseFloat(e.target.value) || 0)
                }
                className="border-border/40 tabular-nums"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
