import { Wifi, WifiOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface LiveStatusProps {
  isLive: boolean;
}

export function LiveStatus({ isLive }: LiveStatusProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 cursor-default text-xs font-medium",
            isLive ? "text-green-500" : "text-muted-foreground",
          )}
        >
          {isLive ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          <span>{isLive ? "Live" : "Offline"}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isLive ? "Live" : "Offline"}</p>
      </TooltipContent>
    </Tooltip>
  );
}

