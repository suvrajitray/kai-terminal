import { useBrokerStore } from "@/stores/broker-store";
import { useFunds } from "@/hooks/use-funds";
import { BROKERS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function BrokerStatusChips() {
  const credentials     = useBrokerStore((s) => s.credentials);
  const removeCredentials = useBrokerStore((s) => s.removeCredentials);
  const { allFunds, loading: fundsLoading } = useFunds();

  const connectedBrokers = BROKERS.filter((b) => credentials[b.id]);

  if (connectedBrokers.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {connectedBrokers.map((broker) => {
        const creds   = credentials[broker.id];
        const isAuthed = !!creds?.accessToken;
        const funds   = broker.id === "upstox" ? allFunds.upstox : allFunds.zerodha;

        return (
          <Popover key={broker.id}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
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
              </button>
            </PopoverTrigger>

            <PopoverContent className="w-52 p-3" align="end">
              <div className="space-y-3">
                <div className="space-y-1.5">
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
                        <span className="flex items-baseline gap-1">
                          <span className="text-muted-foreground">Available</span>
                          <span className="font-semibold tabular-nums text-foreground">
                            ₹{funds.availableMargin.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          </span>
                        </span>
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
