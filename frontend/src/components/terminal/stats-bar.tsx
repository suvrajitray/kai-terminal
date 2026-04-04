import { useEffect, useState } from "react";
import { RefreshCw, LogOut, Wifi, WifiOff, ShieldCheck, PanelRight, BarChart2 } from "lucide-react";
import { PayoffChartDialog } from "./payoff-chart-dialog";
import { SessionTimer } from "./session-timer";
import { MtmDisplay } from "./mtm-display";
import { PositionCountBadges } from "./position-count-badges";
import { KeyboardShortcutsHelp } from "./keyboard-shortcuts-help";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRiskConfig } from "@/hooks/use-risk-config";
import { useBrokerStore } from "@/stores/broker-store";
import { BROKERS } from "@/lib/constants";
import { useShallow } from "zustand/react/shallow";
import { BrokerBadge } from "@/components/ui/broker-badge";
import type { Position } from "@/types";


export interface PpBrokerEntry {
  broker: string;
  target: number;
  currentSl: number;
  trailing: boolean;
}

interface StatsBarProps {
  positions: Position[];
  isLive: boolean;
  loading: boolean;
  acting: string | null;
  onRefresh: () => void;
  onExitAll: () => void;
  onOpenProfitProtection: () => void;
  ppBrokers: PpBrokerEntry[];
  onToggleChain: () => void;
  chainOpen: boolean;
}

export function StatsBar({
  positions,
  isLive,
  loading,
  acting,
  onRefresh,
  onExitAll,
  onOpenProfitProtection,
  ppBrokers,
  onToggleChain,
  chainOpen,
}: StatsBarProps) {
  const connectedBrokers = useBrokerStore(useShallow((s) => BROKERS.filter((b) => s.isAuthenticated(b.id))));
  const multipleConnected = connectedBrokers.length > 1;
  // For single-broker: the inline PP toggle controls the active broker's enabled state.
  // For multi-broker: the inline toggle is hidden; user manages per-broker state in the panel.
  const singleBroker   = connectedBrokers[0]?.id ?? "upstox";
  const { setEnabled } = useRiskConfig(singleBroker);
  const ppEnabled      = ppBrokers.length > 0;
  const [payoffOpen, setPayoffOpen] = useState(false);

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
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-3">
      {/* Live indicator — icon only below xl */}
      <span
        title={isLive ? "Live" : "Offline"}
        className={cn("flex shrink-0 items-center gap-1 text-xs font-medium", isLive ? "text-green-500" : "text-muted-foreground")}
      >
        {isLive ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
        <span className="hidden xl:inline">{isLive ? "Live" : "Offline"}</span>
      </span>

      {/* Session timer — hidden below xl */}
      <span className="hidden xl:flex">
        <SessionTimer />
      </span>

      {positions.length > 0 && (
        <>
          <MtmDisplay value={totalPnl} />

<PositionCountBadges openCount={openCount} closedCount={closedCount} />

          {/* Peak / Trough — hidden below 2xl */}
          {(maxProfit !== null || maxLoss !== null) && (
            <>
              <div className="hidden 2xl:block h-4 w-px bg-border" />
              <span className="hidden 2xl:flex items-center gap-3 text-xs">
                {maxProfit !== null && (
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">Peak</span>
                    <span className={cn("font-mono tabular-nums font-medium", maxProfit >= 0 ? "text-green-500" : "text-red-500")}>
                      {maxProfit >= 0 ? "+" : "-"}₹{Math.abs(maxProfit).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </span>
                )}
                {maxLoss !== null && maxLoss !== maxProfit && (
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">Trough</span>
                    <span className={cn("font-mono tabular-nums font-medium", maxLoss >= 0 ? "text-green-500" : "text-red-500")}>
                      {maxLoss >= 0 ? "+" : "-"}₹{Math.abs(maxLoss).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </span>
                )}
              </span>
            </>
          )}
        </>
      )}


      {/* PP target / SL — abbreviated labels */}
      {ppBrokers.length > 0 && (
        <>
          <div className="h-4 w-px bg-border" />
          <span className="flex items-center gap-1.5 text-xs">
            {ppBrokers.length === 1 ? (
              <>
                <span className="text-muted-foreground">TGT</span>
                <span className="font-mono font-medium tabular-nums text-green-500">
                  ₹{ppBrokers[0].target.toLocaleString("en-IN")}
                </span>
                <span className="text-muted-foreground">SL</span>
                <span className="font-mono font-medium tabular-nums text-red-500">
                  ₹{ppBrokers[0].currentSl.toLocaleString("en-IN")}
                </span>
              </>
            ) : (
              ppBrokers.map((b, i) => (
                <>
                  {i > 0 && <div key={`sep-${i}`} className="h-4 w-px bg-border" />}
                  <span key={b.broker} className="flex items-center gap-1">
                    <BrokerBadge brokerId={b.broker} />
                    <span className="text-muted-foreground">TGT</span>
                    <span className="font-mono font-medium tabular-nums text-green-500">
                      ₹{b.target.toLocaleString("en-IN")}
                    </span>
                    <span className="text-muted-foreground">SL</span>
                    <span className="font-mono font-medium tabular-nums text-red-500">
                      ₹{b.currentSl.toLocaleString("en-IN")}
                    </span>
                  </span>
                </>
              ))
            )}
          </span>
        </>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Profit Protection — text hidden below xl, icon always visible */}
        <button
          onClick={onOpenProfitProtection}
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors",
            ppEnabled
              ? "text-green-500 hover:bg-green-500/10"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          title={ppEnabled ? "Profit Protection ON — click to configure" : "Click to configure Profit Protection"}
        >
          <ShieldCheck className="size-3.5" />
          <span className="hidden xl:inline">Profit Protection</span>
          {/* inline toggle — only shown for single-broker sessions */}
          {!multipleConnected && (
            <span
              onClick={(e) => { e.stopPropagation(); setEnabled(!ppEnabled); }}
              className={cn(
                "ml-0.5 inline-flex h-4 w-7 cursor-pointer items-center rounded-full border border-transparent transition-colors",
                ppEnabled ? "bg-green-500" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "mx-0.5 h-3 w-3 rounded-full bg-white transition-transform",
                  ppEnabled ? "translate-x-3" : "translate-x-0",
                )}
              />
            </span>
          )}
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
        {openCount > 0 && (
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            onClick={() => setPayoffOpen(true)}
            title="P&L at expiry payoff chart"
          >
            <BarChart2 className="size-3" />
          </Button>
        )}
        <KeyboardShortcutsHelp />
        <Button
          size="icon"
          variant="ghost"
          className={cn("size-6", chainOpen && "text-primary bg-primary/10")}
          onClick={onToggleChain}
          title={chainOpen ? "Hide option chain" : "Show option chain"}
        >
          <PanelRight className="size-3" />
        </Button>
      </div>

      <PayoffChartDialog
        open={payoffOpen}
        onOpenChange={setPayoffOpen}
        positions={positions}
      />
    </div>
  );
}

