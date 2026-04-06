import { useState, useEffect, useMemo } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "@/lib/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useRiskConfig } from "@/hooks/use-risk-config";
import { useBrokerStore } from "@/stores/broker-store";
import { BROKERS } from "@/lib/constants";
import { useShallow } from "zustand/react/shallow";
import type { Position } from "@/types";

interface ProfitProtectionPanelProps {
  open: boolean;
  onClose: () => void;
  positions: Position[];
}

interface Draft {
  enabled: boolean;
  watchedProducts: "All" | "Intraday" | "Delivery";
  mtmTarget: string;
  mtmSl: string;
  trailingEnabled: boolean;
  trailingActivateAt: string;
  lockProfitAt: string;
  increaseBy: string;
  trailBy: string;
  autoShiftEnabled: boolean;
  autoShiftThresholdPct: string;
  autoShiftMaxCount: string;
  autoShiftStrikeGap: string;
}

const toStr = (n: number) => String(n);
const fromStr = (s: string) => Number(s);

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none",
        checked ? "bg-green-500" : "bg-muted-foreground/30",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

export function ProfitProtectionPanel({ open, onClose, positions }: ProfitProtectionPanelProps) {
  const connectedBrokers = useBrokerStore(useShallow((s) => BROKERS.filter((b) => s.isAuthenticated(b.id))));
  const multipleConnected = connectedBrokers.length > 1;

  const defaultBroker = connectedBrokers[0]?.id ?? "upstox";
  const [activeBroker, setActiveBroker] = useState<string>(defaultBroker);

  const upstoxRiskConfig  = useRiskConfig("upstox");
  const zerodhaRiskConfig = useRiskConfig("zerodha");
  const dhanRiskConfig    = useRiskConfig("dhan");

  const riskConfigs: Record<string, ReturnType<typeof useRiskConfig>> = {
    upstox:  upstoxRiskConfig,
    zerodha: zerodhaRiskConfig,
    dhan:    dhanRiskConfig,
  };
  const { save } = riskConfigs[activeBroker] ?? upstoxRiskConfig;


  const makeDraft = (broker: string): Draft => {
    const brokerPp = useProfitProtectionStore.getState().getConfig(broker);
    return {
      enabled:               brokerPp.enabled,
      watchedProducts:       brokerPp.watchedProducts,
      mtmTarget:             toStr(brokerPp.mtmTarget),
      mtmSl:                 toStr(brokerPp.mtmSl),
      trailingEnabled:       brokerPp.trailingEnabled,
      trailingActivateAt:    toStr(brokerPp.trailingActivateAt),
      lockProfitAt:          toStr(brokerPp.lockProfitAt),
      increaseBy:            toStr(brokerPp.increaseBy),
      trailBy:               toStr(brokerPp.trailBy),
      autoShiftEnabled:      brokerPp.autoShiftEnabled,
      autoShiftThresholdPct: toStr(brokerPp.autoShiftThresholdPct),
      autoShiftMaxCount:     toStr(brokerPp.autoShiftMaxCount),
      autoShiftStrikeGap:    toStr(brokerPp.autoShiftStrikeGap),
    };
  };

  const [draft, setDraft] = useState<Draft>(() => makeDraft(defaultBroker));

  useEffect(() => {
    if (!open) return;
    const broker = connectedBrokers[0]?.id ?? "upstox";
    setActiveBroker(broker);
    setDraft(makeDraft(broker));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setStr = (key: keyof Draft, value: string | boolean) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleOpen = (isOpen: boolean) => { if (!isOpen) onClose(); };

  const handleBrokerSwitch = (broker: string) => {
    setActiveBroker(broker);
    setDraft(makeDraft(broker));
  };

  const targetVal         = fromStr(draft.mtmTarget);
  const slVal             = fromStr(draft.mtmSl);
  const activateAtVal     = fromStr(draft.trailingActivateAt);
  const lockProfitAtVal   = fromStr(draft.lockProfitAt);
  const increaseByVal     = fromStr(draft.increaseBy);
  const trailByVal        = fromStr(draft.trailBy);
  const hasInvalidNumbers = isNaN(targetVal) || isNaN(slVal) || isNaN(activateAtVal) || isNaN(lockProfitAtVal);

  // Compute MTM scoped to the active broker + draft's watchedProducts so warnings
  // are always accurate for what the risk engine will actually see after saving
  const currentMtm = useMemo(() => positions
    .filter((p) => (p.broker ?? "upstox") === activeBroker)
    .filter((p) => draft.watchedProducts === "All" || p.product === draft.watchedProducts)
    .reduce((sum, p) => sum + p.pnl, 0),
  [positions, activeBroker, draft.watchedProducts]);
  const targetWarning     = !isNaN(targetVal) && targetVal <= currentMtm;
  const slWarning         = !isNaN(slVal) && slVal >= currentMtm;
  const activateAtWarning = draft.trailingEnabled && !isNaN(activateAtVal) && !isNaN(targetVal) && activateAtVal >= targetVal;
  const lockProfitWarning = draft.trailingEnabled && !isNaN(lockProfitAtVal) && !isNaN(targetVal) && lockProfitAtVal >= targetVal;

  const activeBrokerName  = connectedBrokers.find((b) => b.id === activeBroker)?.name ?? activeBroker;

  const handleSave = async () => {
    if (hasInvalidNumbers || targetWarning || slWarning || activateAtWarning || lockProfitWarning) return;
    await save({
      enabled:               draft.enabled,
      watchedProducts:       draft.watchedProducts,
      mtmTarget:             targetVal,
      mtmSl:                 slVal,
      trailingEnabled:       draft.trailingEnabled,
      trailingActivateAt:    activateAtVal,
      lockProfitAt:          lockProfitAtVal,
      increaseBy:            fromStr(draft.increaseBy),
      trailBy:               fromStr(draft.trailBy),
      autoShiftEnabled:      draft.autoShiftEnabled,
      autoShiftThresholdPct: fromStr(draft.autoShiftThresholdPct),
      autoShiftMaxCount:     fromStr(draft.autoShiftMaxCount),
      autoShiftStrikeGap:    fromStr(draft.autoShiftStrikeGap),
    });
    toast.success(`${activeBrokerName} — configuration saved`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">

        {/* ── Header ───────────────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-green-500" />
            Profit Protection
            {multipleConnected && (
              <span className="text-sm font-normal text-muted-foreground">— {activeBrokerName}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Status Banner ────────────────────────────────────────── */}
        <div className={cn(
          "mx-6 mt-4 rounded-lg border px-4 py-3 transition-colors",
          draft.enabled
            ? "border-green-500/30 bg-green-500/5"
            : "border-border bg-muted/20",
        )}>
          <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            {/* Left: broker selector or broker name */}
            {multipleConnected ? (
              <div className="flex gap-1.5">
                {connectedBrokers.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleBrokerSwitch(b.id)}
                    className={cn(
                      "rounded-md border px-3 py-1 text-xs font-semibold transition-all",
                      activeBroker === b.id
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/50 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">{activeBrokerName}</span>
            )}

            {/* Center: MTM */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Current MTM</span>
              <span className={cn(
                "text-lg font-bold tabular-nums leading-tight",
                currentMtm >= 0 ? "text-emerald-500" : "text-rose-500",
              )}>
                ₹{currentMtm.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Right: ON/OFF pill toggle */}
            <button
              onClick={() => setStr("enabled", !draft.enabled)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                draft.enabled
                  ? "border-green-500/50 bg-green-500/15 text-green-500 hover:bg-green-500/20"
                  : "border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:border-border/80",
              )}
            >
              {draft.enabled
                ? <><ShieldCheck className="size-3" /> Enabled</>
                : <><ShieldOff className="size-3" /> Disabled</>
              }
            </button>
          </div>

          {/* Description */}
          <p className={cn(
            "text-[11px] transition-colors",
            draft.enabled ? "text-green-500/70" : "text-muted-foreground/60",
          )}>
            {draft.enabled
              ? "The risk engine will enforce your stop loss, targets, and auto shift rules once saved"
              : "Enable to activate automatic stop loss and target management"
            }
          </p>
          </div>
        </div>

        {/* ── Tabs + content ───────────────────────────────────────── */}
        <div className={cn(
          "transition-opacity duration-200",
          !draft.enabled && "pointer-events-none opacity-40",
        )}>
          <Tabs defaultValue="limits" className="w-full">
            <div className="px-6 pt-4">
              <TabsList variant="line" className="w-full border-b border-border/50 pb-0">
                <TabsTrigger value="limits">Stop Loss &amp; Targets</TabsTrigger>
                <TabsTrigger value="autoshift">Auto Shift</TabsTrigger>
              </TabsList>
            </div>

            {/* ── Tab 1: Limits ──────────────────────────────────── */}
            <TabsContent value="limits" className="px-6 pt-4 pb-5 space-y-4">
              {/* Watched products */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Watch positions</Label>
                <div className="flex gap-1">
                  {(["All", "Intraday", "Delivery"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setDraft((d) => ({ ...d, watchedProducts: opt }))}
                      className={cn(
                        "flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-all",
                        draft.watchedProducts === opt
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-border/50 bg-muted/20 text-muted-foreground hover:border-border hover:text-foreground",
                      )}
                    >
                      {opt === "All" ? "All positions" : opt === "Intraday" ? "MIS only" : "NRML only"}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {draft.watchedProducts === "All"
                    ? "Risk engine evaluates all open positions"
                    : draft.watchedProducts === "Intraday"
                    ? "Risk engine only evaluates MIS / intraday positions — NRML positions are ignored"
                    : "Risk engine only evaluates NRML / delivery positions — MIS positions are ignored"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-10 gap-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mtm-target">MTM Target (₹)</Label>
                  <Input
                    id="mtm-target"
                    type="number"
                    value={draft.mtmTarget}
                    onChange={(e) => setStr("mtmTarget", e.target.value)}
                  />
                  {targetWarning && (
                    <p className="text-[11px] text-destructive">
                      Target must be above current MTM — saving would immediately exit all positions
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Exit all positions when MTM reaches this profit
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mtm-sl">MTM Stop Loss (₹)</Label>
                  <Input
                    id="mtm-sl"
                    type="text"
                    inputMode="numeric"
                    value={draft.mtmSl}
                    onChange={(e) => setStr("mtmSl", e.target.value)}
                  />
                  {slWarning && (
                    <p className="text-[11px] text-destructive">
                      Stop loss must be below current MTM — saving would immediately exit all positions
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Exit all positions when MTM falls to this loss
                  </p>
                </div>
              </div>

              {/* MTM Trailing toggle */}
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
                <Toggle checked={draft.trailingEnabled} onChange={(v) => setStr("trailingEnabled", v)} />
                <span className="text-sm font-medium">MTM Trailing</span>
                <span className="text-xs text-muted-foreground">
                  Automatically raise the stop loss as MTM increases
                </span>
              </div>

              {/* Trailing sub-fields */}
              <div className={cn("space-y-5 transition-opacity", !draft.trailingEnabled && "pointer-events-none opacity-40")}>
                <div className="grid grid-cols-2 gap-x-10">
                  <div className="space-y-1.5">
                    <Label htmlFor="trailing-activate-at" className="whitespace-nowrap">Activate Trailing At (₹)</Label>
                    <Input
                      id="trailing-activate-at"
                      type="number"
                      value={draft.trailingActivateAt}
                      onChange={(e) => setStr("trailingActivateAt", e.target.value)}
                      disabled={!draft.trailingEnabled}
                    />
                    {activateAtWarning && (
                      <p className="text-[11px] text-destructive">
                        Must be below the MTM target — trailing would never trigger
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Trailing starts only after MTM first reaches this profit
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lock-profit-at" className="whitespace-nowrap">Lock Profit At (₹)</Label>
                    <Input
                      id="lock-profit-at"
                      type="number"
                      value={draft.lockProfitAt}
                      onChange={(e) => setStr("lockProfitAt", e.target.value)}
                      disabled={!draft.trailingEnabled}
                    />
                    {lockProfitWarning && (
                      <p className="text-[11px] text-destructive">
                        Must be below the MTM target
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      SL floor jumps to this value the moment trailing activates
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-10">
                  <div className="space-y-1.5">
                    <Label htmlFor="increase-by" className="whitespace-nowrap">Increase In Profit By (₹)</Label>
                    <Input
                      id="increase-by"
                      type="number"
                      value={draft.increaseBy}
                      onChange={(e) => setStr("increaseBy", e.target.value)}
                      disabled={!draft.trailingEnabled}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Step size — how much MTM must gain to trigger a SL raise
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="trail-by" className="whitespace-nowrap">Trail MTM SL By (₹)</Label>
                    <Input
                      id="trail-by"
                      type="number"
                      value={draft.trailBy}
                      onChange={(e) => setStr("trailBy", e.target.value)}
                      disabled={!draft.trailingEnabled}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      How much to raise the stop loss floor per step
                    </p>
                  </div>
                </div>
              </div>

              {/* Trailing summary */}
              {draft.trailingEnabled && !isNaN(increaseByVal) && !isNaN(trailByVal) && !isNaN(slVal) && !isNaN(activateAtVal) && !isNaN(lockProfitAtVal) && (
                <div className="rounded-md bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
                  When MTM first hits{" "}
                  <span className="font-medium text-foreground">₹{activateAtVal.toLocaleString("en-IN")}</span>,
                  {" "}the SL floor locks at{" "}
                  <span className="font-medium text-foreground">₹{lockProfitAtVal.toLocaleString("en-IN")}</span>.
                  {" "}Every time MTM then gains{" "}
                  <span className="font-medium text-foreground">₹{increaseByVal.toLocaleString("en-IN")}</span>,
                  {" "}it rises by{" "}
                  <span className="font-medium text-foreground">₹{trailByVal.toLocaleString("en-IN")}</span>.
                  {" "}Hard SL: <span className="font-medium text-foreground">₹{slVal.toLocaleString("en-IN")}</span>.
                </div>
              )}
            </TabsContent>

            {/* ── Tab 2: Auto Shift ──────────────────────────────── */}
            <TabsContent value="autoshift" className="px-6 pt-4 pb-5 space-y-4">
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
                <Toggle checked={draft.autoShiftEnabled} onChange={(v) => setStr("autoShiftEnabled", v)} />
                <div>
                  <span className="text-sm font-medium">Auto Shift</span>
                  <p className="text-xs text-muted-foreground">
                    When a short option's premium rises by the threshold, shift it further OTM automatically
                  </p>
                </div>
              </div>

              <div className={cn("space-y-5 transition-opacity", !draft.autoShiftEnabled && "pointer-events-none opacity-40")}>
                <div className="grid grid-cols-3 gap-x-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="auto-shift-threshold">Threshold (%)</Label>
                    <Input
                      id="auto-shift-threshold"
                      type="number"
                      min={1}
                      value={draft.autoShiftThresholdPct}
                      onChange={(e) => setStr("autoShiftThresholdPct", e.target.value)}
                      disabled={!draft.autoShiftEnabled}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Trigger when premium rises by this % from entry
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="auto-shift-max-count">Max Shifts</Label>
                    <Input
                      id="auto-shift-max-count"
                      type="number"
                      min={1}
                      value={draft.autoShiftMaxCount}
                      onChange={(e) => setStr("autoShiftMaxCount", e.target.value)}
                      disabled={!draft.autoShiftEnabled}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Exit after this many shifts
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="auto-shift-strike-gap">Strike Gap</Label>
                    <Input
                      id="auto-shift-strike-gap"
                      type="number"
                      min={1}
                      value={draft.autoShiftStrikeGap}
                      onChange={(e) => setStr("autoShiftStrikeGap", e.target.value)}
                      disabled={!draft.autoShiftEnabled}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Strikes to move OTM per shift
                    </p>
                  </div>
                </div>

                <div className="rounded-md bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium text-foreground">How it works:</span>{" "}
                    If a short position's LTP exceeds{" "}
                    <span className="font-medium text-foreground">entry × {(1 + fromStr(draft.autoShiftThresholdPct) / 100).toFixed(2)}×</span>,
                    {" "}it closes and reopens{" "}
                    <span className="font-medium text-foreground">{draft.autoShiftStrikeGap} strike{fromStr(draft.autoShiftStrikeGap) !== 1 ? "s" : ""} further OTM</span>.
                  </p>
                  <p>
                    After <span className="font-medium text-foreground">{draft.autoShiftMaxCount} shift{fromStr(draft.autoShiftMaxCount) !== 1 ? "s" : ""}</span>,
                    {" "}the position is exited entirely. Count resets each trading day.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div className="flex justify-end gap-2 border-t border-border/50 px-6 py-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handleSave} disabled={hasInvalidNumbers || targetWarning || slWarning || activateAtWarning || lockProfitWarning}>Save</Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
