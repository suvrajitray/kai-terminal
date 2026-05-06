import { BarChart2, LogOut, PanelRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { KeyboardShortcutsHelp } from "../keyboard-shortcuts-help";
import { ProfitProtectionControl } from "./profit-protection-control";

interface ConnectedBroker {
  id: string;
  name: string;
}

interface StatsActionsProps {
  connectedBrokers: ConnectedBroker[];
  ppEnabled: boolean;
  openCount: number;
  acting: string | null;
  loading: boolean;
  chainOpen: boolean;
  onOpenProfitProtection: (brokerId?: string) => void;
  onToggleProfitProtection: () => void;
  onExitAll: () => void;
  onRefresh: () => void;
  onOpenPayoff: () => void;
  onToggleChain: () => void;
}

export function StatsActions({
  connectedBrokers,
  ppEnabled,
  openCount,
  acting,
  loading,
  chainOpen,
  onOpenProfitProtection,
  onToggleProfitProtection,
  onExitAll,
  onRefresh,
  onOpenPayoff,
  onToggleChain,
}: StatsActionsProps) {
  return (
    <div className="flex h-9 items-center gap-2 shrink-0 lg:ml-auto border-t border-border/40 lg:border-t-0">
      <ProfitProtectionControl
        connectedBrokers={connectedBrokers}
        ppEnabled={ppEnabled}
        onToggleEnabled={onToggleProfitProtection}
        onOpenProfitProtection={onOpenProfitProtection}
      />

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
              onClick={onOpenPayoff}
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
  );
}

