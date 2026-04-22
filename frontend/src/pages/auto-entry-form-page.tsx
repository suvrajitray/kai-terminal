import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity, ArrowLeft, Calendar, Clock,
  Crosshair, IndianRupee, Minus, Pencil, Plus, RotateCcw,
  Save, TrendingUp, X, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useBrokerStore } from "@/stores/broker-store";
import { BROKERS } from "@/lib/constants";
import { useShallow } from "zustand/react/shallow";
import { useAutoEntry } from "@/hooks/use-auto-entry";
import type { AutoEntryStrategyInput } from "@/hooks/use-auto-entry";
import { getLotSize, INSTRUMENTS } from "@/lib/lot-sizes";


const OPTION_TYPES: { id: string; label: string }[] = [
  { id: "CE", label: "CE" },
  { id: "PE", label: "PE" },
  { id: "CE+PE", label: "CE + PE" },
];
const TRADING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;


const STRIKE_MODES = [
  { id: "ATM",     label: "ATM",     sub: "At-the-money strike",      Icon: Crosshair   },
  { id: "OTM",     label: "OTM",     sub: "Out-of-the-money strike",  Icon: TrendingUp  },
  { id: "Delta",   label: "Delta",   sub: "Select by target delta",   Icon: Activity    },
  { id: "Premium", label: "Premium", sub: "Select by option premium", Icon: IndianRupee },
] as const;

function makeDefault(brokerType: string): AutoEntryStrategyInput {
  return {
    brokerType,
    name: "Morning Sell",
    enabled: true,
    instrument: "NIFTY",
    optionType: "CE+PE",
    lots: 1,
    entryAfterTime: "09:15",
    noEntryAfterTime: "12:15",
    tradingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    excludeExpiryDay: false,
    onlyExpiryDay: false,
    expiryOffset: 0,
    strikeMode: "Delta",
    strikeParam: 0.25,
  };
}

function fmt12h(t: string) {
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
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
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Auto-select first connected broker when brokers load
  useEffect(() => {
    if (isNew && connectedBrokers.length > 0 && !connectedBrokers.find((b) => b.id === draft.brokerType)) {
      field("brokerType", connectedBrokers[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedBrokers.length]);

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

  function adjustOtmParam(delta: number) {
    field("strikeParam", Math.max(0, Math.round(draft.strikeParam) + delta));
  }

  async function handleSave() {
    try {
      if (isNew) { await create(draft); toast.success("Strategy created"); }
      else       { await update(Number(id), draft); toast.success("Strategy updated"); }
      navigate("/auto-entry");
    } catch {
      toast.error("Failed to save strategy");
    }
  }

  const lotSize    = getLotSize(draft.instrument);

  function strikeLabel(mode: string) {
    return mode === "OTM" ? "Strikes from ATM" : mode === "Delta" ? "Delta Value" : "Target Premium (₹)";
  }

  if (!isNew && loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="max-w-[1440px] mx-auto pb-24">

      {/* ── Page header ── */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-5">
          <div>
            <button
              onClick={() => navigate("/auto-entry")}
              className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Auto Entry
            </button>
            <h1 className="text-3xl font-bold tracking-tight">{isNew ? "Create Strategy" : "Edit Strategy"}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Build and automate your trades with precision.
            </p>
          </div>

          {/* Enabled toggle */}
          <div className="shrink-0 flex items-center gap-3 ml-6 mt-1">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full border px-3.5 py-1 cursor-pointer select-none transition-all",
                draft.enabled ? "border-green-500/30 bg-green-500/10" : "border-border/40 bg-muted/10"
              )}
              onClick={() => field("enabled", !draft.enabled)}
            >
              <span className={cn("text-sm font-semibold", draft.enabled ? "text-green-400" : "text-muted-foreground")}>
                {draft.enabled ? "Enabled" : "Disabled"}
              </span>
              <Switch
                checked={draft.enabled}
                onCheckedChange={(v) => field("enabled", v)}
                onClick={(e) => e.stopPropagation()}
                className="data-[state=checked]:bg-green-500 scale-90"
              />
            </div>
          </div>
        </div>

        {/* Name + Broker identity card — full width */}
        <div className="rounded-xl border border-border/40 bg-card overflow-hidden flex items-stretch">
          <div className="flex-1 px-5 py-4">
            <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground/50 mb-2">Strategy Name</p>
            {editingName ? (
              <input
                ref={nameInputRef}
                value={draft.name}
                onChange={(e) => field("name", e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                placeholder="Unnamed Strategy"
                className="bg-transparent border-0 outline-none text-xl font-semibold text-foreground placeholder:text-muted-foreground/30 w-full"
              />
            ) : (
              <button
                type="button"
                onClick={() => { setEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 0); }}
                className="flex items-center gap-2 group/name cursor-pointer"
              >
                <span className="text-xl font-semibold text-foreground">
                  {draft.name || <span className="text-muted-foreground/30">Unnamed Strategy</span>}
                </span>
                <Pencil className="size-3.5 text-muted-foreground/40 group-hover/name:text-muted-foreground/70 transition-colors" />
              </button>
            )}
          </div>
          {connectedBrokers.length > 0 && (
            <>
              <div className="w-px bg-border/40 my-3" />
              <div className="px-5 py-4 flex flex-col justify-center w-[300px] shrink-0">
                <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground/50 mb-2">Broker</p>
                <Select value={draft.brokerType} onValueChange={(v) => field("brokerType", v)}>
                  <SelectTrigger className="h-auto border-0 bg-transparent dark:bg-transparent dark:hover:bg-transparent p-0 shadow-none ring-0 outline-none text-sm font-semibold gap-1.5 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 cursor-pointer [&>svg]:text-muted-foreground/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedBrokers.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="grid grid-cols-[1fr_300px] gap-8 items-start">

        {/* ── Steps ── */}
        <div>

          {/* Step 1 */}
          <StepSection num={1} title="What to Trade" subtitle="Choose instrument, option type and quantity">
            <div className="grid grid-cols-3 gap-6">

              {/* Instrument */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground/70">Instrument</p>
                <div className="relative">
                  <Activity className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-indigo-400" />
                  <Select value={draft.instrument} onValueChange={(v) => field("instrument", v)}>
                    <SelectTrigger className="w-full border-border/50 bg-background pl-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INSTRUMENTS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-muted-foreground">Index · NSE</p>
              </div>

              {/* Option Type */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground/70">Option Type</p>
                <div className="flex gap-1">
                  {OPTION_TYPES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => field("optionType", t.id)}
                      className={cn(
                        "flex-1 rounded-md border px-2 py-2 text-sm font-semibold transition-all",
                        draft.optionType === t.id
                          ? t.id === "CE"
                            ? "border-red-500/50 bg-red-500/15 text-red-300"
                            : t.id === "PE"
                              ? "border-green-500/50 bg-green-500/20 text-green-300"
                              : "border-indigo-500/50 bg-indigo-500/15 text-indigo-300"
                          : "border-border/50 bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">Choose which option to sell</p>
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground/70">Quantity (Lots)</p>
                <div className="flex items-center rounded-md border border-border/50 bg-background">
                  <button
                    onClick={() => field("lots", Math.max(1, draft.lots - 1))}
                    className="flex size-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="flex-1 text-center tabular-nums font-semibold text-sm">{draft.lots}</span>
                  <button
                    onClick={() => field("lots", draft.lots + 1)}
                    className="flex size-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {draft.lots} lot = {draft.lots * lotSize} units
                </p>
              </div>
            </div>
          </StepSection>

          {/* Step 2 */}
          <StepSection num={2} title="When to Trade" subtitle="Set schedule & trading days">
            <div className="space-y-5">

              {/* Trading Days + Entry Window */}
              <div className="grid grid-cols-2 gap-6">

                {/* Trading Days */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground/70">Trading Days</p>
                  <div className={cn("flex gap-1.5 flex-wrap", draft.onlyExpiryDay && "opacity-40 pointer-events-none")}>
                    {TRADING_DAYS.map((day) => (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-sm font-medium transition-all",
                          draft.tradingDays.includes(day)
                            ? "border-green-600/50 bg-green-900/40 text-green-300"
                            : "border-border/50 bg-background text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                    {/* Sat always disabled */}
                    <button disabled className="rounded-md border border-border/30 bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground/40 cursor-not-allowed">
                      Sat
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {draft.onlyExpiryDay
                      ? "Overridden by \"Only on expiry day\""
                      : "Select days when the strategy can run"}
                  </p>
                </div>

                {/* Entry Window */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground/70">Entry Window</p>
                  <div className="flex items-center rounded-md border border-border/50 bg-background px-3 py-2 focus-within:border-indigo-500/40 transition-colors">
                    <Clock className="size-3.5 shrink-0 text-indigo-400 mr-2" />
                    <input
                      type="time"
                      value={draft.entryAfterTime}
                      onChange={(e) => field("entryAfterTime", e.target.value)}
                      className="bg-transparent border-0 outline-none tabular-nums text-sm font-medium text-foreground w-[5.5rem] [&::-webkit-calendar-picker-indicator]:hidden"
                    />
                    <span className="flex-1 text-center text-muted-foreground text-xs">→</span>
                    <div className="ml-auto flex items-center">
                      <Clock className="size-3.5 shrink-0 text-indigo-400 mr-2" />
                      <input
                        type="time"
                        value={draft.noEntryAfterTime}
                        onChange={(e) => field("noEntryAfterTime", e.target.value)}
                        className="bg-transparent border-0 outline-none tabular-nums text-sm font-medium text-foreground w-[5.5rem] text-right [&::-webkit-calendar-picker-indicator]:hidden"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">IST · New positions will only be opened within this time range</p>
                </div>
              </div>

              {/* Expiry toggles */}
              <div className="grid grid-cols-2 gap-3">
                <div className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 transition-all",
                  draft.onlyExpiryDay ? "border-indigo-500/30 bg-indigo-500/5" : "border-border/40 bg-muted/10"
                )}>
                  <Switch
                    id="only-expiry"
                    checked={draft.onlyExpiryDay}
                    onCheckedChange={(v) => {
                      field("onlyExpiryDay", v);
                      if (v) field("excludeExpiryDay", false);
                    }}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <label htmlFor="only-expiry" className="cursor-pointer text-sm font-medium block">
                      Only on expiry day
                    </label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Run only when the day is expiry</p>
                  </div>
                  <Calendar className="size-4 shrink-0 text-muted-foreground/40 mt-0.5" />
                </div>

                <div className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 transition-all",
                  draft.excludeExpiryDay && !draft.onlyExpiryDay
                    ? "border-green-600/30 bg-green-900/10"
                    : "border-border/40 bg-muted/10",
                  draft.onlyExpiryDay && "opacity-40 pointer-events-none"
                )}>
                  <Switch
                    id="skip-expiry"
                    checked={draft.excludeExpiryDay}
                    onCheckedChange={(v) => field("excludeExpiryDay", v)}
                    disabled={draft.onlyExpiryDay}
                    className={cn("mt-0.5 shrink-0", draft.excludeExpiryDay && "data-[state=checked]:bg-green-500")}
                  />
                  <div className="flex-1 min-w-0">
                    <label htmlFor="skip-expiry" className="cursor-pointer text-sm font-medium block">
                      Skip expiry day
                    </label>
                    {draft.excludeExpiryDay && !draft.onlyExpiryDay ? (
                      <p className="text-[11px] text-amber-500/90 mt-0.5">⚠ Recommended for safer automation</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground mt-0.5">Do not trade on expiry date</p>
                    )}
                  </div>
                  <Calendar className="size-4 shrink-0 text-muted-foreground/40 mt-0.5" />
                </div>
              </div>
            </div>
          </StepSection>

          {/* Step 3 */}
          <StepSection num={3} title="How to Select Strike" subtitle="Choose strike selection method">
            <div className="grid grid-cols-4 gap-3">
              {STRIKE_MODES.map(({ id: mode, label, sub, Icon }) => {
                const active      = draft.strikeMode === mode;
                const showParam   = active && mode !== "ATM";
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      field("strikeMode", mode);
                      if (mode === "ATM") field("strikeParam", 0);
                      else if (mode === "Delta" && draft.strikeParam === 0) field("strikeParam", 0.25);
                    }}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      active
                        ? "border-indigo-500/50 bg-indigo-900/30"
                        : "border-border/40 bg-muted/10 hover:border-border/70"
                    )}
                  >
                    {/* Icon + label + radio all on one row */}
                    <div className={cn("flex items-center justify-between gap-2", showParam && "mb-3")}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                          "flex size-8 items-center justify-center rounded-lg shrink-0",
                          active ? "bg-indigo-500/20 text-indigo-400" : "bg-muted/20 text-muted-foreground"
                        )}>
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className={cn("text-sm font-bold leading-tight", active ? "text-foreground" : "text-muted-foreground")}>
                            {label}
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-tight">{sub}</p>
                        </div>
                      </div>
                      <div className={cn(
                        "size-3.5 rounded-full border-2 shrink-0",
                        active
                          ? "border-green-400 bg-green-400 shadow shadow-green-400/40"
                          : "border-muted-foreground/30"
                      )} />
                    </div>

                    {/* Param embedded inside active card */}
                    {showParam && (
                      <div className="mt-4 pt-3 border-t border-indigo-500/20" onClick={(e) => e.stopPropagation()}>
                        <p className="text-[10px] text-muted-foreground mb-2">{strikeLabel(mode)}</p>

                        {mode === "OTM" ? (
                          /* Integer +/- stepper for OTM */
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); adjustOtmParam(-1); }}
                              className="flex size-6 items-center justify-center rounded border border-border/50 bg-background/80 text-muted-foreground hover:text-foreground"
                            >
                              <Minus className="size-2.5" />
                            </button>
                            <span className="flex-1 text-center tabular-nums text-sm font-bold">
                              {Math.round(draft.strikeParam)}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); adjustOtmParam(1); }}
                              className="flex size-6 items-center justify-center rounded border border-border/50 bg-background/80 text-muted-foreground hover:text-foreground"
                            >
                              <Plus className="size-2.5" />
                            </button>
                          </div>
                        ) : (
                          /* Number input for Delta and Premium */
                          <Input
                            type="number"
                            min={0}
                            step={mode === "Delta" ? 0.01 : 1}
                            value={mode === "Delta" ? draft.strikeParam : Math.round(draft.strikeParam)}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v)) field("strikeParam", Math.max(0, v));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 border-border/50 bg-background/80 text-sm font-semibold tabular-nums"
                          />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </StepSection>

          {/* Step 4 */}
          <StepSection num={4} title="Expiry Selection" subtitle="Pick which expiry to use" last>
            <div className="flex items-center gap-6">
              <div className="space-y-2 w-64">
                <p className="text-xs font-medium text-foreground/70">Expiry Selection</p>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-indigo-400 z-10" />
                  <Select
                    value={String(draft.expiryOffset)}
                    onValueChange={(v) => field("expiryOffset", parseInt(v))}
                  >
                    <SelectTrigger className="border-border/50 pl-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Nearest Expiry (0)</SelectItem>
                      <SelectItem value="1">Next Expiry (+1)</SelectItem>
                      <SelectItem value="2">Next-Next Expiry (+2)</SelectItem>
                      <SelectItem value="3">Expiry +3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-5">0 = Nearest weekly or monthly expiry</p>
            </div>
          </StepSection>
        </div>

        {/* ── Sidebar ── */}
        <div className="sticky top-20 space-y-4">

          {/* Live Preview header */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base font-bold">Live Preview</span>
              <div className="flex items-center gap-1.5 ml-1">
                <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">Updates as you edit</span>
              </div>
            </div>

            {/* Preview card */}
            <div className={cn(
              "rounded-xl border p-4",
              draft.enabled ? "border-green-800/40 bg-green-950/30" : "border-border/40 bg-muted/10"
            )}>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-900/60 text-indigo-300 border border-indigo-700/40">
                  AUTO ENTRY
                </span>
                <span className={cn(
                  "ml-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  draft.enabled
                    ? "bg-green-700/40 text-green-300 border border-green-700/30"
                    : "bg-muted/30 text-muted-foreground"
                )}>
                  {draft.enabled ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-xl font-bold leading-tight">
                <span className="text-muted-foreground font-medium text-base">SELL</span>{" "}
                <span>{draft.lots}</span>{" "}
                <span className="font-medium">lot{draft.lots !== 1 ? "s" : ""}</span>{" "}
                <span>{draft.instrument}</span>{" "}
                <span className={
                  draft.optionType === "CE" ? "text-red-400"
                  : draft.optionType === "PE" ? "text-green-400"
                  : "text-indigo-400"
                }>{draft.optionType}</span>
              </p>
              <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Activity className="size-3 shrink-0 text-indigo-400" />
                  <span>Strike: {
                    draft.strikeMode === "ATM"     ? "ATM"
                    : draft.strikeMode === "OTM"   ? `OTM +${draft.strikeParam}`
                    : draft.strikeMode === "Delta" ? `Delta ${draft.strikeParam.toFixed(2)}`
                    : `₹${draft.strikeParam}`
                  }</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="size-3 shrink-0 text-indigo-400" />
                  <span>{draft.onlyExpiryDay ? "Expiry day only" : draft.tradingDays.length === 5 ? "Mon – Fri" : draft.tradingDays.join(", ") || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-3 shrink-0 text-indigo-400" />
                  <span>{fmt12h(draft.entryAfterTime)} – {fmt12h(draft.noEntryAfterTime)}</span>
                </div>
                {!draft.onlyExpiryDay && draft.excludeExpiryDay && (
                  <div className="flex items-center gap-2">
                    <Clock className="size-3 shrink-0 text-indigo-400" />
                    <span>Skip expiry days</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Strategy Summary */}
          <div className="rounded-xl border border-border/40 bg-card p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-bold">Strategy Summary</span>
              <div className="flex-1 border-t border-border/40" />
            </div>
            <div className="space-y-2.5 text-sm">
              {[
                { label: "Name",          value: draft.name || "—",      colored: false, editPen: true },
                { label: "Instrument",    value: draft.instrument,        colored: false },
                { label: "Option",        value: draft.optionType,
                  colored: draft.optionType === "PE" ? "green" : draft.optionType === "CE" ? "red" : "indigo" },
                { label: "Quantity",      value: `${draft.lots} lot${draft.lots !== 1 ? "s" : ""} (${draft.lots * lotSize} units)`, colored: false },
                { label: "Strike Method",  value: draft.strikeMode + (draft.strikeMode !== "ATM" ? ` ${draft.strikeMode === "Delta" ? draft.strikeParam.toFixed(2) : draft.strikeParam}` : ""), colored: false },
                { label: "Days",          value: draft.onlyExpiryDay ? "Expiry only" : draft.tradingDays.join(", ") || "—", colored: false },
                { label: "Time Window",   value: `${draft.entryAfterTime} – ${draft.noEntryAfterTime} IST`, colored: false },
                { label: "Expiry",        value: draft.expiryOffset === 0 ? "Nearest Expiry" : `Expiry +${draft.expiryOffset}`, colored: false },
              ].map(({ label, value, colored, editPen }) => (
                <div key={label} className="flex items-baseline justify-between gap-2">
                  <span className="shrink-0 text-muted-foreground text-xs">{label}</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn(
                      "text-right font-medium tabular-nums text-xs truncate",
                      colored === "green" && "text-green-400",
                      colored === "red"   && "text-red-400",
                      colored === "indigo" && "text-indigo-400",
                    )}>
                      {value}
                    </span>
                    {editPen && <Pencil className="size-2.5 text-muted-foreground/40 shrink-0" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status tip */}
          <div className={cn(
            "flex items-start gap-2.5 rounded-xl border p-3 text-xs",
            draft.enabled
              ? "border-green-700/40 bg-green-950/40 text-green-300"
              : "border-border/40 bg-muted/10 text-muted-foreground"
          )}>
            <Zap className="size-3.5 shrink-0 mt-0.5 text-yellow-400" />
            <span>
              {draft.enabled
                ? "Looks good! Your strategy is ready to automate."
                : "Strategy is disabled and will not run automatically."}
            </span>
          </div>

          {/* Pro Tip */}
          {draft.strikeMode === "Delta" && (
            <div className="rounded-xl border border-indigo-800/40 bg-indigo-950/40 p-3 text-xs space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-indigo-800/50 text-indigo-300">💡</span>
                Pro Tip
              </p>
              <p className="text-muted-foreground">
                Delta between 0.15 – 0.35 works best for option selling strategies.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/40 bg-background/95 backdrop-blur-sm px-6 lg:px-8 py-3 flex items-center justify-between">
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-foreground gap-2"
          onClick={() => setDraft(makeDefault(connectedBrokers[0]?.id ?? "upstox"))}
          disabled={saving}
        >
          <RotateCcw className="size-4" />
          Reset
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-border/40 gap-2" onClick={() => navigate("/auto-entry")} disabled={saving}>
            <X className="size-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-500 text-white border-0 gap-2">
            <Save className="size-4" />
            {saving ? "Saving…" : "Save Strategy"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Step section ── */
function StepSection({
  num, title, subtitle, children, last = false,
}: {
  num: number; title: string; subtitle: string; children: React.ReactNode; last?: boolean;
}) {
  return (
    <div className="flex gap-5 mb-1">
      {/* Circle + connector */}
      <div className="flex flex-col items-center shrink-0">
        <div className="flex size-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/25">
          {num}
        </div>
        {!last && <div className="mt-2 w-px flex-1 bg-border/30 min-h-8" />}
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-w-0", !last && "pb-8")}>
        <h3 className="text-base font-semibold leading-none mt-1.5">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-4 rounded-xl border border-border/50 bg-card p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
