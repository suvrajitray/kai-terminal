import { Wallet } from "lucide-react";
import { useBrokerStore } from "@/stores/broker-store";
import { useFunds } from "@/hooks/use-funds";
import { BROKERS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { FundsData } from "@/services/trading-api";

export function BrokerStatusChips() {
  const credentials       = useBrokerStore((s) => s.credentials);
  const removeCredentials = useBrokerStore((s) => s.removeCredentials);
  const { allFunds, loading: fundsLoading, refresh } = useFunds();

  const connectedBrokers = BROKERS.filter((b) => credentials[b.id]);

  if (connectedBrokers.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {connectedBrokers.map((broker) => {
        const creds    = credentials[broker.id];
        const isAuthed = !!creds?.accessToken;
        const funds    = broker.id === "upstox" ? allFunds.upstox : allFunds.zerodha;
        const pillBar  = getUtilization(funds);

        return (
          <Popover key={broker.id} onOpenChange={(open) => { if (open) refresh(); }}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  isAuthed
                    ? "border-green-500/30 bg-green-500/10 text-green-500 hover:bg-green-500/20"
                    : "border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/60",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isAuthed ? "bg-green-500" : "bg-muted-foreground/50",
                  )}
                />
                {broker.name}
                {isAuthed && pillBar != null && (
                  <span className="flex h-1.5 w-8 overflow-hidden rounded-full bg-white/10">
                    <span
                      className={cn("h-full rounded-full transition-all", pillBar.color)}
                      style={{ width: `${pillBar.pct}%` }}
                    />
                  </span>
                )}
              </button>
            </PopoverTrigger>

            <PopoverContent className="w-52 p-3" align="end">
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{broker.name}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        isAuthed
                          ? "bg-green-500/15 text-green-500"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {isAuthed ? "Connected" : "No token"}
                    </span>
                  </div>

                  {isAuthed && (
                    <div className="text-xs">
                      {fundsLoading ? (
                        <span className="animate-pulse text-muted-foreground">Loading…</span>
                      ) : funds?.availableMargin != null ? (
                        <MarginGauge funds={funds} />
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={() => removeCredentials(broker.id)}
                >
                  Disconnect
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}

function getUtilization(funds: FundsData | null) {
  if (!funds || funds.availableMargin == null || funds.usedMargin == null) return null;
  const available = funds.availableMargin;
  const used      = funds.usedMargin;
  if (available == null || used == null) return null;
  const total = available + used;
  if (total <= 0) return null;
  const pct   = (used / total) * 100;
  const color = pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-green-500/80";
  return { pct, color };
}

function MarginGauge({ funds }: { funds: FundsData }) {
  const available = funds.availableMargin!;
  const used      = funds.usedMargin;
  const total     = used != null ? available + used : null;
  const pct       = total != null && total > 0 ? (used! / total) * 100 : null;
  const gaugeColor =
    pct == null ? "bg-green-500" :
    pct > 80    ? "bg-red-500"   :
    pct > 50    ? "bg-amber-500" :
                  "bg-green-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Wallet className="size-3" />
          <span>Margin</span>
        </span>
        {pct != null && (
          <span className={cn(
            "font-mono text-[10px] font-medium",
            pct > 80 ? "text-red-500" : pct > 50 ? "text-amber-500" : "text-green-500",
          )}>
            {pct.toFixed(0)}% used
          </span>
        )}
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full border border-border/40 bg-muted/60">
        <div
          className={cn("h-full rounded-full transition-all", gaugeColor)}
          style={{ width: pct != null ? `${pct}%` : "0%" }}
        />
      </div>

      <div className="flex items-baseline justify-between">
        <span className="font-mono font-semibold tabular-nums text-foreground">
          ₹{available.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </span>
        {used != null && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            ₹{used.toLocaleString("en-IN", { maximumFractionDigits: 0 })} used
          </span>
        )}
      </div>
    </div>
  );
}
