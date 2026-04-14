import { useState } from "react";
import { RefreshCw, LogOut, Wifi, WifiOff, ShieldCheck, PanelRight, BarChart2, Filter } from "lucide-react";
import { PayoffChartDialog } from "../payoff-chart-dialog";
import { SessionTimer } from "../session-timer";
import { MtmDisplay } from "../mtm-display";
import { PositionCountBadges } from "../position-count-badges";
import { KeyboardShortcutsHelp } from "../keyboard-shortcuts-help";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useRiskConfig } from "@/hooks/use-risk-config";
import { useBrokerStore } from "@/stores/broker-store";
import { BROKERS } from "@/lib/constants";
import { useShallow } from "zustand/react/shallow";
import { BrokerBadge } from "@/components/ui/broker-badge";
import type { Position } from "@/types";
import { useSessionExtremes } from "./use-session-extremes";
import { PnlBadge } from "./pnl-badge";


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
  productFilter: "Intraday" | "Delivery" | null;
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
  productFilter,
}: StatsBarProps) {
  const connectedBrokers = useBrokerStore(useShallow((s) => BROKERS.filter((b) => s.isAuthenticated(b.id))));
  const multipleConnected = connectedBrokers.length > 1;
  // For single-broker: the inline PP toggle controls the active broker's enabled state.
  // For multi-broker: the inline toggle is hidden; user manages per-broker state in the panel.
  const singleBroker   = connectedBrokers[0]?.id ?? "upstox";
  const { setEnabled } = useRiskConfig(singleBroker);
  const ppEnabled      = ppBrokers.length > 0;
  const [payoffOpen, setPayoffOpen] = useState(false);

  const displayPositions = productFilter ? positions.filter((p) => p.product === productFilter) : positions;
  const openCount = displayPositions.filter((p) => p.quantity !== 0).length;
  const closedCount = displayPositions.filter((p) => p.quantity === 0).length;
  const totalPnl = displayPositions.reduce((s, p) => s + p.pnl, 0);
  // Always track session extremes from total MTM — independent of any active filter
  const allPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const { maxProfit, maxLoss } = useSessionExtremes(allPnl, positions.length > 0);

  return (
    <div className="flex flex-col lg:flex-row shrink-0 border-b border-border bg-muted/40 px-3">
      {/* Row 1 (lg: left) — live status, MTM, counts, peak/trough, PP targets */}
      <div className="flex h-9 items-center gap-2 flex-1 min-w-0 overflow-hidden">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn("flex shrink-0 items-center gap-1 cursor-default text-xs font-medium", isLive ? "text-green-500" : "text-muted-foreground")}
            >
              {isLive ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
              <span>{isLive ? "Live" : "Offline"}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isLive ? "Live" : "Offline"}</p>
          </TooltipContent>
        </Tooltip>

        <SessionTimer />

        {displayPositions.length > 0 && (
          <>
            <MtmDisplay value={totalPnl} />
            {productFilter && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] cursor-default font-medium text-amber-500">
                    <Filter className="size-2.5" />
                    {productFilter}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Filtered: {productFilter} only</p>
                </TooltipContent>
              </Tooltip>
            )}
            <PositionCountBadges openCount={openCount} closedCount={closedCount} />

            {(maxProfit !== null || maxLoss !== null) && (
              <>
                <div className="h-4 w-px bg-border" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-3 text-xs cursor-default">
                      {maxProfit !== null && (
                        <span className="flex items-center gap-1">
                          <span className="text-muted-foreground">↑</span>
                          <PnlBadge value={maxProfit} />
                        </span>
                      )}
                      {maxLoss !== null && maxLoss !== maxProfit && (
                        <span className="flex items-center gap-1">
                          <span className="text-muted-foreground">↓</span>
                          <PnlBadge value={maxLoss} />
                        </span>
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Session peak / trough MTM</p>
                  </TooltipContent>
                </Tooltip>
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
                  <span className="font-mono font-medium tabular-nums text-emerald-500">
                    ₹{ppBrokers[0].target.toLocaleString("en-IN")}
                  </span>
                  <span className="text-muted-foreground">SL</span>
                  <span className="font-mono font-medium tabular-nums text-rose-500">
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
                      <span className="font-mono font-medium tabular-nums text-emerald-500">
                        ₹{b.target.toLocaleString("en-IN")}
                      </span>
                      <span className="text-muted-foreground">SL</span>
                      <span className="font-mono font-medium tabular-nums text-rose-500">
                        ₹{b.currentSl.toLocaleString("en-IN")}
                      </span>
                    </span>
                  </>
                ))
              )}
            </span>
          </>
        )}
      </div>

      {/* Row 2 (lg: right) — actions; subtle top border only below lg */}
      <div className="flex h-9 items-center gap-2 shrink-0 lg:ml-auto border-t border-border/40 lg:border-t-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onOpenProfitProtection}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors",
                ppEnabled
                  ? "text-green-500 hover:bg-green-500/10"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <ShieldCheck className="size-3.5" />
              <span>Profit Protection</span>
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
          </TooltipTrigger>
          <TooltipContent>
            <p>{ppEnabled ? "Profit Protection ON — click to configure" : "Click to configure Profit Protection"}</p>
          </TooltipContent>
        </Tooltip>

        <div className="h-4 w-px bg-border" />

        {openCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent>
              <p>Exit all open positions [E]</p>
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Refresh [R]</p>
          </TooltipContent>
        </Tooltip>
        {openCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                onClick={() => setPayoffOpen(true)}
              >
                <BarChart2 className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>P&L at expiry payoff chart</p>
            </TooltipContent>
          </Tooltip>
        )}
        <KeyboardShortcutsHelp />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className={cn("size-6", chainOpen && "text-primary bg-primary/10")}
              onClick={onToggleChain}
            >
              <PanelRight className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{chainOpen ? "Hide option chain" : "Show option chain"}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <PayoffChartDialog
        open={payoffOpen}
        onOpenChange={setPayoffOpen}
        positions={positions}
      />
    </div>
  );
}
