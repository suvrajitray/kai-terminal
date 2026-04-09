import { useSyncExternalStore } from "react";
import { Timer } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function subscribe(cb: () => void) {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
}
const getSnapshot = () => Math.floor(Date.now() / 1000);

const MARKET_CLOSE_SECS = (15 * 60 + 30) * 60; // 15:30 in seconds since midnight

function getSessionRemaining(): { h: number; m: number; s: number; urgent: boolean } | null {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const h = ist.getHours(), m = ist.getMinutes(), s = ist.getSeconds();
  const totalSecs = h * 3600 + m * 60 + s;
  const openSecs  = 9 * 3600 + 15 * 60;
  if (totalSecs < openSecs || totalSecs >= MARKET_CLOSE_SECS) return null;
  const remaining = MARKET_CLOSE_SECS - totalSecs;
  return {
    h: Math.floor(remaining / 3600),
    m: Math.floor((remaining % 3600) / 60),
    s: remaining % 60,
    urgent: remaining <= 30 * 60, // last 30 minutes
  };
}

export function SessionTimer() {
  useSyncExternalStore(subscribe, getSnapshot);
  const remaining = getSessionRemaining();
  if (!remaining) return null;

  const { h, m, s, urgent } = remaining;
  const label = h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m`
    : `${m}m ${String(s).padStart(2, "0")}s`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`hidden cursor-default items-center gap-1 text-xs sm:flex ${urgent ? "text-amber-400" : "text-muted-foreground"}`}
        >
          <Timer className="size-3 shrink-0" />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>Time until market close (15:30 IST)</p>
      </TooltipContent>
    </Tooltip>
  );
}
