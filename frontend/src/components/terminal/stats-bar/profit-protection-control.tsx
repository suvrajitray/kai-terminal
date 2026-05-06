import { ShieldCheck } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ConnectedBroker {
  id: string;
  name: string;
}

interface ProfitProtectionControlProps {
  connectedBrokers: ConnectedBroker[];
  ppEnabled: boolean;
  onToggleEnabled: () => void;
  onOpenProfitProtection: (brokerId?: string) => void;
}

export function ProfitProtectionControl({
  connectedBrokers,
  ppEnabled,
  onToggleEnabled,
  onOpenProfitProtection,
}: ProfitProtectionControlProps) {
  const singleBroker = connectedBrokers[0]?.id ?? "upstox";

  if (connectedBrokers.length > 1) {
    return (
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <ProfitProtectionButton ppEnabled={ppEnabled} />
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <ProfitProtectionTooltip ppEnabled={ppEnabled} />
        </Tooltip>
        <DropdownMenuContent align="end">
          {connectedBrokers.map((broker) => (
            <DropdownMenuItem key={broker.id} onClick={() => onOpenProfitProtection(broker.id)}>
              {broker.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ProfitProtectionButton
          ppEnabled={ppEnabled}
          onClick={() => onOpenProfitProtection(singleBroker)}
          toggle={<InlineToggle ppEnabled={ppEnabled} onToggle={onToggleEnabled} />}
        />
      </TooltipTrigger>
      <ProfitProtectionTooltip ppEnabled={ppEnabled} />
    </Tooltip>
  );
}

function ProfitProtectionButton({
  ppEnabled,
  onClick,
  toggle,
}: {
  ppEnabled: boolean;
  onClick?: () => void;
  toggle?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors",
        ppEnabled ? "text-green-500 hover:bg-green-500/10" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <ShieldCheck className="size-3.5" />
      <span>Profit Protection</span>
      {toggle}
    </button>
  );
}

function InlineToggle({ ppEnabled, onToggle }: { ppEnabled: boolean; onToggle: () => void }) {
  return (
    <span
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
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
  );
}

function ProfitProtectionTooltip({ ppEnabled }: { ppEnabled: boolean }) {
  return (
    <TooltipContent>
      <p>{ppEnabled ? "Profit Protection ON — click to configure" : "Click to configure Profit Protection"}</p>
    </TooltipContent>
  );
}

