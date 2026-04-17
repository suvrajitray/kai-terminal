import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useRiskConfig } from "@/hooks/use-risk-config";
import { usePpDraft } from "@/components/terminal/profit-protection-panel/use-pp-draft";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useBrokerStore } from "@/stores/broker-store";
import { cn } from "@/lib/utils";

// ─── Per-broker form ──────────────────────────────────────────────────────────

function BrokerPPForm({ broker }: { broker: "upstox" | "zerodha" }) {
  const { save } = useRiskConfig(broker);
  const ppDraft = usePpDraft(broker, []);
  const isLoaded = useProfitProtectionStore((s) => s.loadedBrokers.includes(broker));
  const [saving, setSaving] = useState(false);

  const { draft, setField, toggleEnabled, canSave, toSavePayload, warnings } = ppDraft;

  async function handleSave() {
    setSaving(true);
    try {
      await save(toSavePayload());
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="px-4 pt-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded-md bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Enable row */}
      <div className="mx-4 flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Protect Profit</p>
          <p className="text-xs text-muted-foreground">
            {draft.enabled ? "Active — monitoring positions" : "Inactive"}
          </p>
        </div>
        <Switch checked={draft.enabled} onCheckedChange={toggleEnabled} />
      </div>

      {/* Form body — dimmed when disabled */}
      <div className={cn("flex flex-col gap-4 transition-opacity duration-200", !draft.enabled && "opacity-50 pointer-events-none")}>

        {/* Watch positions */}
        <div className="px-4 space-y-2">
          <Label className="text-xs text-muted-foreground">Watch positions</Label>
          <div className="flex gap-2">
            {(["All", "Intraday", "Delivery"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setField("watchedProducts", opt)}
                className={cn(
                  "flex-1 rounded-md border px-2 py-2 text-xs font-medium transition-all",
                  draft.watchedProducts === opt
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/40 bg-muted/20 text-muted-foreground",
                )}
              >
                {opt === "All" ? "All" : opt === "Intraday" ? "MIS" : "NRML"}
              </button>
            ))}
          </div>
        </div>

        {/* MTM Target + Stop Loss */}
        <div className="px-4 grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${broker}-mtm-target`} className="text-xs">
              MTM Target (₹)
            </Label>
            <Input
              id={`${broker}-mtm-target`}
              type="number"
              value={draft.mtmTarget}
              onChange={(e) => setField("mtmTarget", e.target.value)}
              className="tabular-nums"
            />
            {warnings.targetWarning && (
              <p className="text-[11px] text-destructive">Below current MTM</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${broker}-mtm-sl`} className="text-xs">
              MTM Stop (₹)
            </Label>
            <Input
              id={`${broker}-mtm-sl`}
              type="text"
              inputMode="numeric"
              value={draft.mtmSl}
              onChange={(e) => setField("mtmSl", e.target.value)}
              className="tabular-nums"
            />
            {warnings.slWarning && (
              <p className="text-[11px] text-destructive">Above current MTM</p>
            )}
          </div>
        </div>

        {/* Trailing SL */}
        <div className="px-4 space-y-3">
          <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-4 py-3">
            <div>
              <p className="text-sm font-medium">MTM Trailing</p>
              <p className="text-xs text-muted-foreground">Raise stop loss as profit grows</p>
            </div>
            <Switch
              checked={draft.trailingEnabled}
              onCheckedChange={(v: boolean) => setField("trailingEnabled", v)}
            />
          </div>

          {draft.trailingEnabled && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`${broker}-activate-at`} className="text-xs">
                    Activate At (₹)
                  </Label>
                  <Input
                    id={`${broker}-activate-at`}
                    type="number"
                    value={draft.trailingActivateAt}
                    onChange={(e) => setField("trailingActivateAt", e.target.value)}
                    className="tabular-nums"
                  />
                  {warnings.activateAtWarning && (
                    <p className="text-[11px] text-destructive">Must be below target</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${broker}-lock-at`} className="text-xs">
                    Lock At (₹)
                  </Label>
                  <Input
                    id={`${broker}-lock-at`}
                    type="number"
                    value={draft.lockProfitAt}
                    onChange={(e) => setField("lockProfitAt", e.target.value)}
                    className="tabular-nums"
                  />
                  {warnings.lockProfitWarning && (
                    <p className="text-[11px] text-destructive">Must be below target</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`${broker}-increase-by`} className="text-xs">
                    Increase By (₹)
                  </Label>
                  <Input
                    id={`${broker}-increase-by`}
                    type="number"
                    value={draft.increaseBy}
                    onChange={(e) => setField("increaseBy", e.target.value)}
                    className="tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${broker}-trail-by`} className="text-xs">
                    Trail By (₹)
                  </Label>
                  <Input
                    id={`${broker}-trail-by`}
                    type="number"
                    value={draft.trailBy}
                    onChange={(e) => setField("trailBy", e.target.value)}
                    className="tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Auto Shift */}
        <div className="px-4 space-y-3">
          <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Auto Shift</p>
              <p className="text-xs text-muted-foreground">Roll short options further OTM on breach</p>
            </div>
            <Switch
              checked={draft.autoShiftEnabled}
              onCheckedChange={(v: boolean) => setField("autoShiftEnabled", v)}
            />
          </div>

          {draft.autoShiftEnabled && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`${broker}-shift-threshold`} className="text-xs">
                  Threshold (%)
                </Label>
                <Input
                  id={`${broker}-shift-threshold`}
                  type="number"
                  min={1}
                  value={draft.autoShiftThresholdPct}
                  onChange={(e) => setField("autoShiftThresholdPct", e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${broker}-shift-max`} className="text-xs">
                  Max Shifts
                </Label>
                <Input
                  id={`${broker}-shift-max`}
                  type="number"
                  min={1}
                  value={draft.autoShiftMaxCount}
                  onChange={(e) => setField("autoShiftMaxCount", e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${broker}-shift-gap`} className="text-xs">
                  Strike Gap
                </Label>
                <Input
                  id={`${broker}-shift-gap`}
                  type="number"
                  min={1}
                  value={draft.autoShiftStrikeGap}
                  onChange={(e) => setField("autoShiftStrikeGap", e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save button */}
      <div className="px-4">
        <Button
          className="w-full"
          onClick={handleSave}
          disabled={!canSave || saving}
        >
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MobilePPPage() {
  const isUpstoxAuthed = useBrokerStore((s) => s.isAuthenticated("upstox"));
  const isZerodhaAuthed = useBrokerStore((s) => s.isAuthenticated("zerodha"));

  const availableBrokers = [
    isUpstoxAuthed && "upstox",
    isZerodhaAuthed && "zerodha",
  ].filter(Boolean) as ("upstox" | "zerodha")[];

  const [activeBroker, setActiveBroker] = useState<"upstox" | "zerodha">(
    availableBrokers[0] ?? "upstox",
  );

  if (availableBrokers.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Connect a broker to configure Profit Protection.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold mb-3">Profit Protection</h2>
        {availableBrokers.length > 1 && (
          <Tabs
            value={activeBroker}
            onValueChange={(v) => setActiveBroker(v as "upstox" | "zerodha")}
          >
            <TabsList className="w-full mb-1">
              {availableBrokers.map((b) => (
                <TabsTrigger key={b} value={b} className="flex-1 capitalize">
                  {b}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      <BrokerPPForm key={activeBroker} broker={activeBroker} />
    </div>
  );
}
