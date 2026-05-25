import { KeyRound, ShieldCheck, Star, Wallet } from "lucide-react";
import { useBrokerStore } from "@/stores/broker-store";
import { useFunds } from "@/hooks/use-funds";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { BROKERS, UPSTOX_OAUTH_URL, ZERODHA_OAUTH_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { FundsData } from "@/services/trading-api";

export function BrokerStatusChips() {
  const credentials      = useBrokerStore((s) => s.credentials);
  const brokerPriority   = useBrokerStore((s) => s.brokerPriority);
  const setDefaultBroker = useBrokerStore((s) => s.setDefaultBroker);
  const { allFunds, loading: fundsLoading, refresh } = useFunds();
  const ppConfigs         = useProfitProtectionStore((s) => s.configs);

  const connectedBrokers = BROKERS.filter((b) => credentials[b.id]);
  const defaultBrokerId =
    connectedBrokers.length > 1
      ? (brokerPriority.find((id) => connectedBrokers.some((b) => b.id === id)) ?? connectedBrokers[0]?.id)
      : null;

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
                {broker.id === defaultBrokerId && (
                  <Star className="size-2.5 fill-current" />
                )}
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

                {connectedBrokers.length > 1 && broker.id !== defaultBrokerId && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs border-border/50 text-muted-foreground hover:text-foreground"
                      onClick={() => setDefaultBroker(broker.id)}
                    >
                      <Star className="mr-1.5 size-3" />
                      Set as default
                    </Button>
                    <Separator />
                  </>
                )}

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      "flex-1 h-7 text-xs",
                      ppConfigs[broker.id]?.enabled
                        ? "border-green-500/30 text-green-500 hover:bg-green-500/10 hover:text-green-500"
                        : "border-border/50 text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => useProfitProtectionStore.getState().requestOpen(broker.id)}
                  >
                    <ShieldCheck className="mr-1.5 size-3" />
                    Profit Protection
                  </Button>

                  {!isAuthed && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 shrink-0 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/50"
                          onClick={() => {
                            const storedKey = creds?.apiKey;
                            if (!storedKey) return;
                            const redirectUrl = `${window.location.origin}${broker.redirectPath}`;
                            let url: string;
                            if (broker.id === "upstox") {
                              const params = new URLSearchParams({ response_type: "code", client_id: storedKey, redirect_uri: redirectUrl });
                              url = `${UPSTOX_OAUTH_URL}?${params.toString()}`;
                            } else {
                              const params = new URLSearchParams({ v: "3", api_key: storedKey });
                              url = `${ZERODHA_OAUTH_URL}?${params.toString()}`;
                            }
                            window.location.href = url;
                          }}
                        >
                          <KeyRound className="size-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Authenticate {broker.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
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
