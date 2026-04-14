// frontend/src/components/terminal/profit-protection-panel/index.tsx
import { useState, useCallback } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "@/lib/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRiskConfig } from "@/hooks/use-risk-config";
import { useBrokerStore } from "@/stores/broker-store";
import { BROKERS } from "@/lib/constants";
import { useShallow } from "zustand/react/shallow";
import { usePpDraft } from "./use-pp-draft";
import { BrokerPpForm } from "./broker-pp-form";
import type { Position } from "@/types";

interface ProfitProtectionPanelProps {
  open: boolean;
  onClose: () => void;
  positions: Position[];
}

export function ProfitProtectionPanel({ open, onClose, positions }: ProfitProtectionPanelProps) {
  const connectedBrokers = useBrokerStore(useShallow((s) => BROKERS.filter((b) => s.isAuthenticated(b.id))));
  const multipleConnected = connectedBrokers.length > 1;
  const defaultBroker = connectedBrokers[0]?.id ?? "upstox";
  const [activeBroker, setActiveBroker] = useState(defaultBroker);

  const upstoxConfig  = useRiskConfig("upstox");
  const zerodhaConfig = useRiskConfig("zerodha");
  const dhanConfig    = useRiskConfig("dhan");
  const riskConfigs: Record<string, ReturnType<typeof useRiskConfig>> = {
    upstox: upstoxConfig, zerodha: zerodhaConfig, dhan: dhanConfig,
  };

  const {
    draft, setField, toggleEnabled, resetToBroker,
    currentMtm, warnings, canSave, toSavePayload,
    increaseByVal, trailByVal, slVal, activateAtVal, lockProfitAtVal,
  } = usePpDraft(activeBroker, positions);

  // Reset when dialog opens
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) { onClose(); return; }
    const broker = connectedBrokers[0]?.id ?? "upstox";
    setActiveBroker(broker);
    resetToBroker(broker);
  }, [connectedBrokers, onClose, resetToBroker]);

  const handleBrokerSwitch = useCallback((broker: string) => {
    setActiveBroker(broker);
    resetToBroker(broker);
  }, [resetToBroker]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    const { save } = riskConfigs[activeBroker] ?? upstoxConfig;
    await save(toSavePayload());
    const name = connectedBrokers.find((b) => b.id === activeBroker)?.name ?? activeBroker;
    toast.success(`${name} — configuration saved`);
    onClose();
  }, [canSave, activeBroker, riskConfigs, upstoxConfig, toSavePayload, connectedBrokers, onClose]);

  const activeBrokerName = connectedBrokers.find((b) => b.id === activeBroker)?.name ?? activeBroker;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-green-500" />
            Profit Protection
            {multipleConnected && (
              <span className="text-sm font-normal text-muted-foreground">
                — {activeBrokerName}
              </span>
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
              onClick={toggleEnabled}
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

        <BrokerPpForm
          draft={draft}
          onField={setField}
          toggleEnabled={toggleEnabled}
          targetWarning={warnings.targetWarning}
          slWarning={warnings.slWarning}
          activateAtWarning={warnings.activateAtWarning}
          lockProfitWarning={warnings.lockProfitWarning}
          increaseByVal={increaseByVal}
          trailByVal={trailByVal}
          slVal={slVal}
          activateAtVal={activateAtVal}
          lockProfitAtVal={lockProfitAtVal}
        />

        <div className="flex justify-end gap-2 border-t border-border/50 px-6 py-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handleSave} disabled={!canSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
