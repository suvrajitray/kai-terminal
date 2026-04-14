import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type MarketStatus = "open" | "pre-open" | "closed";

function getMarketStatus(): MarketStatus {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const day = ist.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return "closed";

  const h = ist.getHours();
  const m = ist.getMinutes();
  const mins = h * 60 + m;

  if (mins >= 9 * 60 && mins < 9 * 60 + 15)  return "pre-open";
  if (mins >= 9 * 60 + 15 && mins < 15 * 60 + 30) return "open";
  return "closed";
}

// Minimal clock store — updates every 30s
function subscribe(cb: () => void) {
  const id = setInterval(cb, 30_000);
  return () => clearInterval(id);
}
const getSnapshot = () => Date.now();

export function MarketStatus() {
  useSyncExternalStore(subscribe, getSnapshot);
  const status = getMarketStatus();

  const config = {
    open:     { label: "Market Open",     dot: "bg-green-500 animate-pulse", text: "text-green-500",  border: "border-green-500/20 bg-green-500/10"  },
    "pre-open": { label: "Pre-Open",      dot: "bg-amber-500 animate-pulse", text: "text-amber-500",  border: "border-amber-500/20 bg-amber-500/10"  },
    closed:   { label: "Market Closed",   dot: "bg-muted-foreground",        text: "text-muted-foreground", border: "border-border/50 bg-muted/30" },
  }[status];

  return (
    <span className={cn("hidden sm:flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", config.border, config.text)}>
      <span className={cn("size-1.5 rounded-full shrink-0", config.dot)} />
      {config.label}
    </span>
  );
}
