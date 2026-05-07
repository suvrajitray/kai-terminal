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
  onOpenProfitProtection: (brokerId?: string) => void;
}

export function ProfitProtectionControl({
  connectedBrokers,
  ppEnabled,
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
        />
      </TooltipTrigger>
      <ProfitProtectionTooltip ppEnabled={ppEnabled} />
    </Tooltip>
  );
}

function ProfitProtectionButton({
  ppEnabled,
  className,
  ...rest
}: React.ComponentPropsWithoutRef<"button"> & {
  ppEnabled: boolean;
}) {
  return (
    <button
      {...rest}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors",
        ppEnabled ? "text-green-500 hover:bg-green-500/10" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <ShieldCheck className="size-3.5" />
      <span>Profit Protection</span>
    </button>
  );
}

function ProfitProtectionTooltip({ ppEnabled }: { ppEnabled: boolean }) {
  return (
    <TooltipContent>
      <p>{ppEnabled ? "Profit Protection ON — click to configure" : "Click to configure Profit Protection"}</p>
    </TooltipContent>
  );
}
