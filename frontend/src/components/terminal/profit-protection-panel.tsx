import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import type { ProfitProtectionConfig } from "@/stores/profit-protection-store";

interface ProfitProtectionPanelProps {
  open: boolean;
  onClose: () => void;
  currentMtm: number;
}

export function ProfitProtectionPanel({ open, onClose, currentMtm }: ProfitProtectionPanelProps) {
  const store = useProfitProtectionStore();

  const [draft, setDraft] = useState({
    mtmTarget: store.mtmTarget,
    mtmSl: store.mtmSl,
    trailingEnabled: store.trailingEnabled,
    increaseBy: store.increaseBy,
    trailBy: store.trailBy,
  });

  const set = (key: keyof ProfitProtectionConfig, value: number | boolean) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      // Reset draft to current store values when dialog opens
      setDraft({
        mtmTarget: store.mtmTarget,
        mtmSl: store.mtmSl,
        trailingEnabled: store.trailingEnabled,
        increaseBy: store.increaseBy,
        trailBy: store.trailBy,
      });
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    store.setConfig({ ...draft, enabled: store.enabled });
    onClose();
  };

  const targetWarning = draft.mtmTarget <= currentMtm;

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
              onChange={(e) => set("mtmTarget", Number(e.target.value))}
            />
            {targetWarning && (
              <p className="text-[11px] text-amber-500">
                Target profit should be greater than current MTM
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
              type="number"
              value={draft.mtmSl}
              onChange={(e) => set("mtmSl", Number(e.target.value))}
            />
            <p className="text-[11px] text-muted-foreground">
              Exit all positions when MTM falls to this loss
            </p>
          </div>

          {/* MTM Trailing toggle */}
          <div className="col-span-2 flex items-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
            <button
              role="switch"
              aria-checked={draft.trailingEnabled}
              onClick={() => set("trailingEnabled", !draft.trailingEnabled)}
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
          <div className={cn("col-span-2 grid grid-cols-2 gap-x-8 transition-opacity", !draft.trailingEnabled && "pointer-events-none opacity-40")}>
            <div className="space-y-1.5">
              <Label htmlFor="increase-by" className="whitespace-nowrap">Increase In Profit By (₹)</Label>
              <Input
                id="increase-by"
                type="number"
                value={draft.increaseBy}
                onChange={(e) => set("increaseBy", Number(e.target.value))}
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
                onChange={(e) => set("trailBy", Number(e.target.value))}
                disabled={!draft.trailingEnabled}
              />
              <p className="text-[11px] text-muted-foreground">
                How much to raise the stop loss floor per step
              </p>
            </div>
          </div>
        </div>

        {/* Summary */}
        {draft.trailingEnabled && (
          <div className="rounded-md bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
            Every time MTM gains <span className="font-medium text-foreground">₹{draft.increaseBy.toLocaleString("en-IN")}</span>,
            {" "}the stop loss floor rises by{" "}
            <span className="font-medium text-foreground">₹{draft.trailBy.toLocaleString("en-IN")}</span>.
            {" "}Starting SL: <span className="font-medium text-foreground">₹{draft.mtmSl.toLocaleString("en-IN")}</span>.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
