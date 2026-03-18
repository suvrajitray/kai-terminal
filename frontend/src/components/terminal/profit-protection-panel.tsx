import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useRiskConfig } from "@/hooks/use-risk-config";
import { useBrokerStore } from "@/stores/broker-store";
import { BROKERS } from "@/lib/constants";
import { useShallow } from "zustand/react/shallow";

interface ProfitProtectionPanelProps {
  open: boolean;
  onClose: () => void;
  currentMtm: number;
}

// Draft stores numbers as strings so mid-typing states (e.g. "-", "1.") don't get clobbered.
interface Draft {
  mtmTarget: string;
  mtmSl: string;
  trailingEnabled: boolean;
  trailingActivateAt: string;
  lockProfitAt: string;
  increaseBy: string;
  trailBy: string;
}

const toStr = (n: number) => String(n);
const fromStr = (s: string) => Number(s);

export function ProfitProtectionPanel({ open, onClose, currentMtm }: ProfitProtectionPanelProps) {
  const connectedBrokers = useBrokerStore(useShallow((s) => BROKERS.filter((b) => s.isAuthenticated(b.id))));
  const multipleConnected = connectedBrokers.length > 1;

  const [activeBroker, setActiveBroker] = useState<string>(
    connectedBrokers[0]?.id ?? "upstox"
  );

  // Hooks must be called unconditionally — one per known broker in BROKERS.
  // When adding a new broker (e.g. "dhan"), add one line here and to the record below.
  const upstoxRiskConfig  = useRiskConfig("upstox");
  const zerodhaRiskConfig = useRiskConfig("zerodha");
  const dhanRiskConfig    = useRiskConfig("dhan");

  const riskConfigs: Record<string, ReturnType<typeof useRiskConfig>> = {
    upstox:  upstoxRiskConfig,
    zerodha: zerodhaRiskConfig,
    dhan:    dhanRiskConfig,
  };
  const { save, setEnabled } = riskConfigs[activeBroker] ?? upstoxRiskConfig;

  const pp = useProfitProtectionStore((s) => s.getConfig(activeBroker));

  const storeAsDraft = (): Draft => ({
    mtmTarget:          toStr(pp.mtmTarget),
    mtmSl:              toStr(pp.mtmSl),
    trailingEnabled:    pp.trailingEnabled,
    trailingActivateAt: toStr(pp.trailingActivateAt),
    lockProfitAt:       toStr(pp.lockProfitAt),
    increaseBy:         toStr(pp.increaseBy),
    trailBy:            toStr(pp.trailBy),
  });

  const [draft, setDraft] = useState<Draft>(storeAsDraft);

  const setStr = (key: keyof Draft, value: string | boolean) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setDraft(storeAsDraft());
    else onClose();
  };

  // Reset draft when switching broker tabs
  const handleBrokerSwitch = (broker: string) => {
    setActiveBroker(broker);
    const brokerPp = useProfitProtectionStore.getState().getConfig(broker);
    setDraft({
      mtmTarget:          toStr(brokerPp.mtmTarget),
      mtmSl:              toStr(brokerPp.mtmSl),
      trailingEnabled:    brokerPp.trailingEnabled,
      trailingActivateAt: toStr(brokerPp.trailingActivateAt),
      lockProfitAt:       toStr(brokerPp.lockProfitAt),
      increaseBy:         toStr(brokerPp.increaseBy),
      trailBy:            toStr(brokerPp.trailBy),
    });
  };

  const targetVal          = fromStr(draft.mtmTarget);
  const slVal              = fromStr(draft.mtmSl);
  const activateAtVal      = fromStr(draft.trailingActivateAt);
  const lockProfitAtVal    = fromStr(draft.lockProfitAt);
  const hasInvalidNumbers  = isNaN(targetVal) || isNaN(slVal) || isNaN(activateAtVal) || isNaN(lockProfitAtVal);
  const targetWarning      = !isNaN(targetVal) && targetVal <= currentMtm;
  const slWarning          = !isNaN(slVal) && slVal >= currentMtm;
  const activateAtWarning  = draft.trailingEnabled && !isNaN(activateAtVal) && !isNaN(targetVal) && activateAtVal >= targetVal;
  const lockProfitWarning  = draft.trailingEnabled && !isNaN(lockProfitAtVal) && !isNaN(targetVal) && lockProfitAtVal >= targetVal;

  const handleSave = async () => {
    if (hasInvalidNumbers || targetWarning || slWarning || activateAtWarning || lockProfitWarning) return;
    await save({
      enabled:            pp.enabled,
      mtmTarget:          targetVal,
      mtmSl:              slVal,
      trailingEnabled:    draft.trailingEnabled,
      trailingActivateAt: activateAtVal,
      lockProfitAt:       lockProfitAtVal,
      increaseBy:         fromStr(draft.increaseBy),
      trailBy:            fromStr(draft.trailBy),
    });
    onClose();
  };

  const increaseByVal = fromStr(draft.increaseBy);
  const trailByVal    = fromStr(draft.trailBy);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-green-500" />
            Profit Protection
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              Current MTM{" "}
              <span className={cn("font-semibold tabular-nums", currentMtm >= 0 ? "text-green-500" : "text-red-500")}>
                ₹{currentMtm.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Broker selector — only shown when multiple brokers are connected */}
        {multipleConnected && (
          <div className="flex gap-1 rounded-lg bg-muted/40 p-1">
            {connectedBrokers.map((b) => (
              <button
                key={b.id}
                onClick={() => handleBrokerSwitch(b.id)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  activeBroker === b.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-8 gap-y-5 pt-2">
          {/* MTM Target */}
          <div className="space-y-1.5">
            <Label htmlFor="mtm-target">MTM Target</Label>
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

          {/* MTM SL */}
          <div className="space-y-1.5">
            <Label htmlFor="mtm-sl">MTM Stop Loss</Label>
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

          {/* MTM Trailing toggle */}
          <div className="col-span-2 flex items-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
            <button
              role="switch"
              aria-checked={draft.trailingEnabled}
              onClick={() => setStr("trailingEnabled", !draft.trailingEnabled)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none",
                draft.trailingEnabled ? "bg-green-500" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform",
                  draft.trailingEnabled ? "translate-x-4" : "translate-x-0",
                )}
              />
            </button>
            <span className="text-sm font-medium">MTM Trailing</span>
            <span className="text-xs text-muted-foreground">
              Automatically raise the stop loss as MTM increases
            </span>
          </div>

          {/* Trailing fields — only when trailing enabled */}
          <div className={cn("col-span-2 space-y-5 transition-opacity", !draft.trailingEnabled && "pointer-events-none opacity-40")}>
            {/* Activate at / Lock profit at */}
            <div className="grid grid-cols-2 gap-x-8">
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

            {/* Increase by / Trail by */}
            <div className="grid grid-cols-2 gap-x-8">
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
        </div>

        {/* Summary */}
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

        {/* PP enable/disable toggle for active broker */}
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-4 py-3">
          <div>
            <span className="text-sm font-medium capitalize">
              {multipleConnected ? `${connectedBrokers.find((b) => b.id === activeBroker)?.name ?? activeBroker} ` : ""}Profit Protection
            </span>
            <p className="text-[11px] text-muted-foreground">
              Enable to activate automatic stop loss and target management
            </p>
          </div>
          <button
            role="switch"
            aria-checked={pp.enabled}
            onClick={() => setEnabled(!pp.enabled)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none",
              pp.enabled ? "bg-green-500" : "bg-muted-foreground/30",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform",
                pp.enabled ? "translate-x-4" : "translate-x-0",
              )}
            />
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handleSave} disabled={hasInvalidNumbers || targetWarning || slWarning || activateAtWarning || lockProfitWarning}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
