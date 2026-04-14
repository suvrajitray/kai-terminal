// frontend/src/components/terminal/profit-protection-panel/trailing-stop-section.tsx
import { memo } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { Draft } from "./use-pp-draft";

interface TrailingStopSectionProps {
  draft: Draft;
  onField: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  activateAtWarning: boolean;
  lockProfitWarning: boolean;
  increaseByVal: number;
  trailByVal: number;
  slVal: number;
  activateAtVal: number;
  lockProfitAtVal: number;
}

export const TrailingStopSection = memo(function TrailingStopSection({
  draft, onField, activateAtWarning, lockProfitWarning,
  increaseByVal, trailByVal, slVal, activateAtVal, lockProfitAtVal,
}: TrailingStopSectionProps) {
  return (
    <>
      {/* Trailing sub-fields */}
      <div className={cn("space-y-5 transition-opacity", !draft.trailingEnabled && "pointer-events-none opacity-40")}>
        <div className="grid grid-cols-2 gap-x-10">
          <div className="space-y-1.5">
            <Label htmlFor="trailing-activate-at" className="whitespace-nowrap">Activate Trailing At (₹)</Label>
            <Input
              id="trailing-activate-at"
              type="number"
              value={draft.trailingActivateAt}
              onChange={(e) => onField("trailingActivateAt", e.target.value)}
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
              onChange={(e) => onField("lockProfitAt", e.target.value)}
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
              onChange={(e) => onField("increaseBy", e.target.value)}
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
              onChange={(e) => onField("trailBy", e.target.value)}
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
    </>
  );
});
