// frontend/src/components/terminal/profit-protection-panel/broker-pp-form.tsx
import { memo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { TrailingStopSection } from "./trailing-stop-section";
import type { Draft } from "./use-pp-draft";

interface BrokerPpFormProps {
  draft: Draft;
  onField: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  targetWarning: boolean;
  slWarning: boolean;
  activateAtWarning: boolean;
  lockProfitWarning: boolean;
  increaseByVal: number;
  trailByVal: number;
  slVal: number;
  activateAtVal: number;
  lockProfitAtVal: number;
}

export const BrokerPpForm = memo(function BrokerPpForm({
  draft, onField,
  targetWarning, slWarning, activateAtWarning, lockProfitWarning,
  increaseByVal, trailByVal, slVal, activateAtVal, lockProfitAtVal,
}: BrokerPpFormProps) {
  return (
    <div className={cn("transition-opacity duration-200", !draft.enabled && "pointer-events-none opacity-40")}>
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
                  onClick={() => onField("watchedProducts", opt)}
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
                onChange={(e) => onField("mtmTarget", e.target.value)}
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
                onChange={(e) => onField("mtmSl", e.target.value)}
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
            <Switch checked={draft.trailingEnabled} onCheckedChange={(v: boolean) => onField("trailingEnabled", v)} />
            <span className="text-sm font-medium">MTM Trailing</span>
            <span className="text-xs text-muted-foreground">
              Automatically raise the stop loss as MTM increases
            </span>
          </div>

          <TrailingStopSection
            draft={draft}
            onField={onField}
            activateAtWarning={activateAtWarning}
            lockProfitWarning={lockProfitWarning}
            increaseByVal={increaseByVal}
            trailByVal={trailByVal}
            slVal={slVal}
            activateAtVal={activateAtVal}
            lockProfitAtVal={lockProfitAtVal}
          />
        </TabsContent>

        {/* ── Tab 2: Auto Shift ──────────────────────────────── */}
        <TabsContent value="autoshift" className="px-6 pt-4 pb-5 space-y-4">
          <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
            <Switch checked={draft.autoShiftEnabled} onCheckedChange={(v: boolean) => onField("autoShiftEnabled", v)} />
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
                  onChange={(e) => onField("autoShiftThresholdPct", e.target.value)}
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
                  onChange={(e) => onField("autoShiftMaxCount", e.target.value)}
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
                  onChange={(e) => onField("autoShiftStrikeGap", e.target.value)}
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
                <span className="font-medium text-foreground">entry × {(1 + Number(draft.autoShiftThresholdPct) / 100).toFixed(2)}×</span>,
                {" "}it closes and reopens{" "}
                <span className="font-medium text-foreground">{draft.autoShiftStrikeGap} strike{Number(draft.autoShiftStrikeGap) !== 1 ? "s" : ""} further OTM</span>.
              </p>
              <p>
                After <span className="font-medium text-foreground">{draft.autoShiftMaxCount} shift{Number(draft.autoShiftMaxCount) !== 1 ? "s" : ""}</span>,
                {" "}the position is exited entirely. Count resets each trading day.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});
