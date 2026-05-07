import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useRiskConfig } from "@/hooks/use-risk-config";
import { usePpDraft } from "@/components/terminal/profit-protection-panel/use-pp-draft";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useBrokerStore } from "@/stores/broker-store";
import { cn } from "@/lib/utils";
import { WatchedProductsField } from "./mobile-pp-form/watched-products-field";
import { MtmTargetsField } from "./mobile-pp-form/mtm-targets-field";
import { TrailingSlSection } from "./mobile-pp-form/trailing-sl-section";
import { AutoShiftSection } from "./mobile-pp-form/auto-shift-section";

// ─── Per-broker form ──────────────────────────────────────────────────────────

function BrokerPPForm({ broker }: { broker: "upstox" | "zerodha" }) {
  const { save } = useRiskConfig(broker);
  const ppDraft = usePpDraft(broker);
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
        <WatchedProductsField
          value={draft.watchedProducts}
          onChange={(v) => setField("watchedProducts", v)}
        />

        <MtmTargetsField
          broker={broker}
          mtmTarget={draft.mtmTarget}
          mtmSl={draft.mtmSl}
          targetWarning={warnings.targetWarning}
          slWarning={warnings.slWarning}
          onTargetChange={(v) => setField("mtmTarget", v)}
          onSlChange={(v) => setField("mtmSl", v)}
        />

        <TrailingSlSection
          broker={broker}
          enabled={draft.trailingEnabled}
          activateAt={draft.trailingActivateAt}
          lockProfitAt={draft.lockProfitAt}
          increaseBy={draft.increaseBy}
          trailBy={draft.trailBy}
          activateAtWarning={warnings.activateAtWarning}
          lockProfitWarning={warnings.lockProfitWarning}
          onEnabledChange={(v) => setField("trailingEnabled", v)}
          onActivateAtChange={(v) => setField("trailingActivateAt", v)}
          onLockProfitAtChange={(v) => setField("lockProfitAt", v)}
          onIncreaseByChange={(v) => setField("increaseBy", v)}
          onTrailByChange={(v) => setField("trailBy", v)}
        />

        <AutoShiftSection
          broker={broker}
          enabled={draft.autoShiftEnabled}
          thresholdPct={draft.autoShiftThresholdPct}
          maxCount={draft.autoShiftMaxCount}
          strikeGap={draft.autoShiftStrikeGap}
          onEnabledChange={(v) => setField("autoShiftEnabled", v)}
          onThresholdPctChange={(v) => setField("autoShiftThresholdPct", v)}
          onMaxCountChange={(v) => setField("autoShiftMaxCount", v)}
          onStrikeGapChange={(v) => setField("autoShiftStrikeGap", v)}
        />
      </div>

      {/* Save button */}
      <div className="px-4">
        <Button className="w-full" onClick={handleSave} disabled={!canSave || saving}>
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
