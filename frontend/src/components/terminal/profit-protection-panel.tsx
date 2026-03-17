import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useRiskConfig } from "@/hooks/use-risk-config";

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
  const store = useProfitProtectionStore();
  const { save } = useRiskConfig();

  const storeAsDraft = (): Draft => ({
    mtmTarget:          toStr(store.mtmTarget),
    mtmSl:              toStr(store.mtmSl),
    trailingEnabled:    store.trailingEnabled,
    trailingActivateAt: toStr(store.trailingActivateAt),
    lockProfitAt:       toStr(store.lockProfitAt),
    increaseBy:         toStr(store.increaseBy),
    trailBy:            toStr(store.trailBy),
  });

  const [draft, setDraft] = useState<Draft>(storeAsDraft);

  const setStr = (key: keyof Draft, value: string | boolean) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setDraft(storeAsDraft());
    else onClose();
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
      enabled:            store.enabled,
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

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handleSave} disabled={hasInvalidNumbers || targetWarning || slWarning || activateAtWarning || lockProfitWarning}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
