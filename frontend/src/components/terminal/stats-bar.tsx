import { useEffect, useState } from "react";
import { RefreshCw, LogOut, Wifi, WifiOff, ShieldCheck, Wallet, Eye, EyeOff } from "lucide-react";
import { useFunds } from "@/hooks/use-funds";
import { SessionTimer } from "./session-timer";
import { MtmDisplay } from "./mtm-display";
import { PositionCountBadges } from "./position-count-badges";
import { KeyboardShortcutsHelp } from "./keyboard-shortcuts-help";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useRiskConfig } from "@/hooks/use-risk-config";
import type { Position } from "@/types";


interface StatsBarProps {
  positions: Position[];
  isLive: boolean;
  loading: boolean;
  acting: string | null;
  onRefresh: () => void;
  onExitAll: () => void;
  onOpenProfitProtection: () => void;
  ppTarget: number | null;
  ppCurrentSl: number | null;
  ppTrailing: boolean;
}

export function StatsBar({
  positions,
  isLive,
  loading,
  acting,
  onRefresh,
  onExitAll,
  onOpenProfitProtection,
  ppTarget,
  ppCurrentSl,
  ppTrailing,
}: StatsBarProps) {
  const { enabled } = useProfitProtectionStore();
  const { setEnabled } = useRiskConfig();
  const { funds, allFunds, loading: fundsLoading } = useFunds();
  const [fundsVisible, setFundsVisible] = useState(
    () => localStorage.getItem("kai-terminal-funds-visible") !== "false"
  );

  const openCount = positions.filter((p) => p.quantity !== 0).length;
  const closedCount = positions.filter((p) => p.quantity === 0).length;
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);

  const STORAGE_KEY = "kai-terminal-mtm-extremes";

  const readStored = (): { maxProfit: number | null; maxLoss: number | null } => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { maxProfit: null, maxLoss: null }; }
    catch { return { maxProfit: null, maxLoss: null }; }
  };

  const [maxProfit, setMaxProfit] = useState<number | null>(() => readStored().maxProfit);
  const [maxLoss, setMaxLoss] = useState<number | null>(() => readStored().maxLoss);

  useEffect(() => {
    if (positions.length === 0) return;
    setMaxProfit((prevMax) => {
      const nextMax = prevMax === null || totalPnl > prevMax ? totalPnl : prevMax;
      setMaxLoss((prevMin) => {
        const nextMin = prevMin === null || totalPnl < prevMin ? totalPnl : prevMin;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ maxProfit: nextMax, maxLoss: nextMin }));
        return nextMin;
      });
      return nextMax;
    });
  }, [totalPnl, positions.length]);

  return (
    <div className="flex h-9 shrink-0 items-center gap-4 border-b border-border bg-muted/40 px-3">
      <span
        title={isLive ? "Live" : "Offline"}
        className={cn("flex items-center gap-1 text-xs font-medium", isLive ? "text-green-500" : "text-muted-foreground")}
      >
        {isLive ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
        {isLive ? "Live" : "Offline"}
      </span>

      <SessionTimer />

      {positions.length > 0 && (
        <>
          <MtmDisplay value={totalPnl} />
          <PositionCountBadges openCount={openCount} closedCount={closedCount} />

          {(maxProfit !== null || maxLoss !== null) && (
            <>
              <div className="h-4 w-px bg-border" />
              <span className="flex items-center gap-3 text-xs">
                {maxProfit !== null && (
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">Peak</span>
                    <span className={cn("tabular-nums font-medium", maxProfit >= 0 ? "text-green-500" : "text-red-500")}>
                      {maxProfit >= 0 ? "+" : "-"}₹{Math.abs(maxProfit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </span>
                )}
                {maxLoss !== null && maxLoss !== maxProfit && (
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">Trough</span>
                    <span className={cn("tabular-nums font-medium", maxLoss >= 0 ? "text-green-500" : "text-red-500")}>
                      {maxLoss >= 0 ? "+" : "-"}₹{Math.abs(maxLoss).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </span>
                )}
              </span>
            </>
          )}
        </>
      )}

      {ppTarget !== null && ppCurrentSl !== null && (
        <>
          <div className="h-4 w-px bg-border" />
          <span className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Target</span>
            <span className="font-medium tabular-nums text-green-500">
              ₹{ppTarget.toLocaleString("en-IN")}
            </span>
            <span className="text-muted-foreground">{ppTrailing ? "Trail SL" : "SL"}</span>
            <span className="font-medium tabular-nums text-red-500">
              ₹{ppCurrentSl.toLocaleString("en-IN")}
            </span>
          </span>
        </>
      )}

      {/* Available Margin — shows per-broker when both connected */}
      <div className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs">
        <Wallet className="size-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Avail</span>
        {fundsLoading ? (
          <span className="animate-pulse tabular-nums text-muted-foreground/60 ml-1">…</span>
        ) : !fundsVisible ? (
          <span className="font-semibold tabular-nums text-muted-foreground/40 ml-1 tracking-widest">••••••</span>
        ) : allFunds.upstox?.availableMargin != null && allFunds.zerodha?.availableMargin != null ? (
          // Both brokers connected — show labelled breakdown
          <span className="flex items-center gap-2 ml-1">
            <span className="flex items-center gap-0.5">
              <span className="text-muted-foreground/60 text-[10px]">U</span>
              <span className="font-semibold tabular-nums text-foreground">
                ₹{allFunds.upstox.availableMargin.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="flex items-center gap-0.5">
              <span className="text-muted-foreground/60 text-[10px]">Z</span>
              <span className="font-semibold tabular-nums text-foreground">
                ₹{allFunds.zerodha.availableMargin.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            </span>
          </span>
        ) : funds?.availableMargin != null ? (
          <span className="font-semibold tabular-nums text-foreground ml-1">
            ₹{funds.availableMargin.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
        ) : (
          <span className="text-muted-foreground/40 ml-1">—</span>
        )}
        <button
          onClick={() => setFundsVisible((v) => {
            localStorage.setItem("kai-terminal-funds-visible", String(!v));
            return !v;
          })}
          title={fundsVisible ? "Hide balance" : "Show balance"}
          className="ml-0.5 rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {fundsVisible ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* Profit Protection */}
        <button
          onClick={onOpenProfitProtection}
          className={cn(
            "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors",
            enabled
              ? "text-green-500 hover:bg-green-500/10"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          title={enabled ? "Profit Protection ON — click to configure" : "Click to configure Profit Protection"}
        >
          <ShieldCheck className="size-3.5" />
          Profit Protection
          {/* inline toggle dot */}
          <span
            onClick={(e) => { e.stopPropagation(); setEnabled(!enabled); }}
            className={cn(
              "ml-0.5 inline-flex h-4 w-7 items-center rounded-full border border-transparent transition-colors",
              enabled ? "bg-green-500" : "bg-muted-foreground/30",
            )}
          >
            <span
              className={cn(
                "mx-0.5 h-3 w-3 rounded-full bg-white transition-transform",
                enabled ? "translate-x-3" : "translate-x-0",
              )}
            />
          </span>
        </button>

        <div className="h-4 w-px bg-border" />

        {openCount > 0 && (
          <Button
            size="sm"
            variant="destructive"
            className="h-6 px-2 text-xs"
            onClick={onExitAll}
            disabled={acting === "all"}
          >
            <LogOut className="mr-1 size-3" />
            Exit All
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} />
        </Button>
        <KeyboardShortcutsHelp />
      </div>
    </div>
  );
}
