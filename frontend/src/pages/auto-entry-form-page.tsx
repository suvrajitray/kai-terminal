import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bot, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useBrokerStore } from "@/stores/broker-store";
import { BROKERS } from "@/lib/constants";
import { useShallow } from "zustand/react/shallow";
import { useAutoEntry } from "@/hooks/use-auto-entry";
import type { AutoEntryStrategyInput } from "@/hooks/use-auto-entry";

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
    entryAfterTime: "09:15",
    noEntryAfterTime: "12:15",
    tradingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    excludeExpiryDay: false,
    onlyExpiryDay: false,
    expiryOffset: 0,
    strikeMode: "ATM",
    strikeParam: 0,
  };
}

export function AutoEntryFormPage() {
  const { id }   = useParams<{ id?: string }>();
  const isNew    = id === undefined;
  const navigate = useNavigate();

  const connectedBrokers = useBrokerStore(useShallow((s) =>
    BROKERS.filter((b) => s.isConnected(b.id))
  ));

  const { strategies, loading, saving, create, update } = useAutoEntry();

  const [draft, setDraft] = useState<AutoEntryStrategyInput>(() =>
    makeDefault(connectedBrokers[0]?.id ?? "upstox")
  );

  useEffect(() => {
    if (!isNew && !loading) {
      const s = strategies.find((s) => s.id === Number(id));
      if (s) {
        setDraft({
          brokerType: s.brokerType, name: s.name, enabled: s.enabled,
          instrument: s.instrument, optionType: s.optionType, lots: s.lots,
          entryAfterTime: s.entryAfterTime, noEntryAfterTime: s.noEntryAfterTime,
          tradingDays: s.tradingDays, excludeExpiryDay: s.excludeExpiryDay,
          onlyExpiryDay: s.onlyExpiryDay,
          expiryOffset: s.expiryOffset, strikeMode: s.strikeMode, strikeParam: s.strikeParam,
        });
      } else {
        navigate("/auto-entry", { replace: true });
      }
    }
  }, [isNew, id, strategies, loading, navigate]);

  function field<K extends keyof AutoEntryStrategyInput>(key: K, value: AutoEntryStrategyInput[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDay(day: string) {
    const days = draft.tradingDays.includes(day)
      ? draft.tradingDays.filter((d) => d !== day)
      : [...draft.tradingDays, day];
    field("tradingDays", days);
  }

  async function handleSave() {
    try {
      if (isNew) { await create(draft); toast.success("Strategy created"); }
      else        { await update(Number(id), draft); toast.success("Strategy updated"); }
      navigate("/auto-entry");
    } catch {
      toast.error("Failed to save strategy");
    }
  }

  const strikeParamLabel =
    draft.strikeMode === "OTM"     ? "Strikes from ATM"
    : draft.strikeMode === "Delta"   ? "Target Delta"
    : draft.strikeMode === "Premium" ? "Target Premium (₹)"
    : null;

  if (!isNew && loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate("/auto-entry")}
            className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Auto Entry
          </button>
          <h1 className="text-2xl font-semibold">{isNew ? "New Strategy" : "Edit Strategy"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isNew ? "Configure a new option-selling automation strategy." : "Update this strategy's settings."}
          </p>
        </div>
        <div className="flex items-center gap-3 pt-7">
          <span className="text-sm text-muted-foreground">{draft.enabled ? "Enabled" : "Disabled"}</span>
          <Switch checked={draft.enabled} onCheckedChange={(v) => field("enabled", v)} />
        </div>
      </div>

      {/* 3-col grid: sections fill cols 1-2, preview spans col 3 across both rows */}
      <div className="grid gap-6 items-start" style={{ gridTemplateColumns: "1fr 1fr 260px" }}>

      {/* Row 1: General + Instrument & Strategy */}

        <FormSection title="General">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Strategy Name">
              <Input
                value={draft.name}
                onChange={(e) => field("name", e.target.value)}
                className="border-border/40"
                placeholder="Morning Sell"
              />
            </Field>
            <Field label="Broker">
              {connectedBrokers.length > 0 ? (
                <Select value={draft.brokerType} onValueChange={(v) => field("brokerType", v)}>
                  <SelectTrigger className="border-border/40 bg-background w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedBrokers.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground pt-1">No brokers connected</p>
              )}
            </Field>
          </div>
        </FormSection>

        <FormSection title="Instrument & Strategy">
          <div className="grid grid-cols-4 gap-4">
            <Field label="Instrument">
              <Select value={draft.instrument} onValueChange={(v) => field("instrument", v)}>
                <SelectTrigger className="border-border/40 bg-background w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTRUMENTS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Lots">
              <Input
                type="number" min={1}
                value={draft.lots}
                onChange={(e) => field("lots", Math.max(1, parseInt(e.target.value) || 1))}
                className="border-border/40 tabular-nums"
              />
            </Field>
            <Field label="Expiry Offset">
              <Input
                type="number" min={0}
                value={draft.expiryOffset}
                onChange={(e) => field("expiryOffset", Math.max(0, parseInt(e.target.value) || 0))}
                className="border-border/40 tabular-nums"
              />
              <p className="text-[11px] text-muted-foreground mt-1">0 = nearest expiry</p>
            </Field>
            <Field label="Option Type">
              <div className="flex gap-1 flex-wrap">
                {OPTION_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => field("optionType", t)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
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
            </Field>
          </div>
        </FormSection>

        {/* Preview — col 3, spans both rows */}
        <div className="row-span-2">
          <div className="sticky top-20">
            <StrategyPreview draft={draft} connectedBrokers={connectedBrokers} />
          </div>
        </div>

      {/* Row 2: Schedule + Strike Selection (col 1 + 2) */}

        <FormSection title="Schedule">
          <div className="space-y-4">

            <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
              <Switch
                id="only-expiry"
                checked={draft.onlyExpiryDay}
                onCheckedChange={(v) => {
                  field("onlyExpiryDay", v);
                  if (v) field("excludeExpiryDay", false);
                }}
                className="mt-0.5 shrink-0"
              />
              <div>
                <label htmlFor="only-expiry" className="cursor-pointer text-sm font-medium">
                  Only on expiry day
                </label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Ignores trading days — runs only when today is the instrument's expiry.
                </p>
              </div>
            </div>

            {!draft.onlyExpiryDay && (
              <>
                <Field label="Trading Days">
                  <div className="flex gap-4 flex-wrap">
                    {TRADING_DAYS.map((day) => (
                      <label key={day} className="flex items-center gap-2 cursor-pointer select-none">
                        <Checkbox
                          checked={draft.tradingDays.includes(day)}
                          onCheckedChange={() => toggleDay(day)}
                        />
                        <span className="text-sm">{day}</span>
                      </label>
                    ))}
                  </div>
                </Field>

                <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
                  <Switch
                    id="skip-expiry"
                    checked={draft.excludeExpiryDay}
                    onCheckedChange={(v) => field("excludeExpiryDay", v)}
                    className="mt-0.5 shrink-0"
                  />
                  <div>
                    <label htmlFor="skip-expiry" className="cursor-pointer text-sm font-medium">
                      Skip expiry day
                    </label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Do not trade on the expiry date of the instrument.
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Entry After (IST)">
                <Input
                  type="time"
                  value={draft.entryAfterTime}
                  onChange={(e) => field("entryAfterTime", e.target.value)}
                  className="border-border/40 tabular-nums"
                />
              </Field>
              <Field label="No Entry After (IST)">
                <Input
                  type="time"
                  value={draft.noEntryAfterTime}
                  onChange={(e) => field("noEntryAfterTime", e.target.value)}
                  className="border-border/40 tabular-nums"
                />
              </Field>
            </div>
          </div>
        </FormSection>

        <FormSection title="Strike Selection">
          <div className="space-y-4">
            <Field label="Mode">
              <div className="flex gap-1.5 flex-wrap">
                {STRIKE_MODES.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => field("strikeMode", mode)}
                    className={cn(
                      "rounded-md border px-5 py-1.5 text-sm font-medium transition-colors",
                      draft.strikeMode === mode
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/40 bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </Field>

            {strikeParamLabel && (
              <Field label={strikeParamLabel}>
                <Input
                  type="number" min={0}
                  step={draft.strikeMode === "Delta" ? 0.01 : 1}
                  value={draft.strikeParam}
                  onChange={(e) => field("strikeParam", parseFloat(e.target.value) || 0)}
                  className="border-border/40 tabular-nums w-40"
                />
              </Field>
            )}
          </div>
        </FormSection>

      </div>{/* end 3-col grid */}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
        <Button variant="outline" className="border-border/40" onClick={() => navigate("/auto-entry")} disabled={saving}>
          <X className="mr-2 size-4" />
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 size-4" />
          {saving ? "Saving…" : "Save Strategy"}
        </Button>
      </div>
    </div>
  );
}

/* ── Primitives ── */

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <div className="mt-2 border-t border-border/40" />
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* ── Preview ── */

function StrategyPreview({
  draft,
  connectedBrokers,
}: {
  draft: AutoEntryStrategyInput;
  connectedBrokers: { id: string; name: string }[];
}) {
  const brokerName = connectedBrokers.find((b) => b.id === draft.brokerType)?.name ?? draft.brokerType;

  const optionColor =
    draft.optionType === "CE" ? "text-red-600 dark:text-red-400"
    : draft.optionType === "PE" ? "text-green-600 dark:text-green-400"
    : "text-primary";

  const strikeLabel =
    draft.strikeMode === "ATM"     ? "ATM"
    : draft.strikeMode === "OTM"   ? `OTM ${draft.strikeParam > 0 ? `+${draft.strikeParam}` : draft.strikeParam}`
    : draft.strikeMode === "Delta" ? `Δ ${draft.strikeParam}`
    : `₹${draft.strikeParam}`;

  const daysLabel = draft.onlyExpiryDay
    ? "Expiry day only"
    : draft.tradingDays.length === 5 ? "Mon – Fri"
    : draft.tradingDays.length === 0 ? "—"
    : draft.tradingDays.join(", ");

  return (
    <Card className="border-border/40 bg-muted/10">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Preview</span>
          <span className={cn("ml-auto size-2 rounded-full", draft.enabled ? "bg-green-500" : "bg-muted-foreground/30")} />
        </div>

        <div className="space-y-2.5 text-sm">
          <PRow label="Name"   value={draft.name || "—"} />
          <PRow label="Broker" value={brokerName} />
          <PRow label="Trade"  value={
            <span>
              SELL <span className="font-medium tabular-nums">{draft.lots}</span>{" "}
              {draft.lots === 1 ? "lot" : "lots"}{" "}
              <span className="font-medium">{draft.instrument}</span>{" "}
              <span className={cn("font-medium", optionColor)}>{draft.optionType}</span>
            </span>
          } />
          <PRow label="Strike" value={strikeLabel} />
          <PRow label="Days"   value={daysLabel} />
          <PRow label="Window" value={
            <span className="tabular-nums">{draft.entryAfterTime} – {draft.noEntryAfterTime}</span>
          } />
          {draft.expiryOffset > 0 && (
            <PRow label="Expiry" value={`+${draft.expiryOffset}`} />
          )}
          {!draft.onlyExpiryDay && draft.excludeExpiryDay && (
            <PRow label="Note" value="Skip expiry day" />
          )}
        </div>

        <div className={cn(
          "rounded-md border px-3 py-2 text-xs",
          draft.enabled
            ? "border-green-500/20 bg-green-500/5 text-green-600 dark:text-green-400"
            : "border-border/40 bg-muted/20 text-muted-foreground"
        )}>
          {draft.enabled ? "Will run automatically" : "Disabled — will not run"}
        </div>
      </CardContent>
    </Card>
  );
}

function PRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

