import { useEffect } from "react";
import { Inbox } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BrokerBadge } from "@/components/ui/broker-badge";
import { useRiskLogStore } from "@/stores/risk-log-store";
import { useAuthStore } from "@/stores/auth-store";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useBrokerStore } from "@/stores/broker-store";
import { API_BASE_URL, BROKERS } from "@/lib/constants";
import type { RiskLogEntry, RiskNotificationType } from "@/types";

function formatRupee(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return value >= 0 ? `₹+${formatted}` : `₹-${formatted}`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return "--:--:--";
  }
}

function watchLabel(broker: string): string {
  const wp = useProfitProtectionStore.getState().getConfig(broker)?.watchedProducts ?? "All";
  return wp === "Intraday" ? "Intraday" : wp === "Delivery" ? "Delivery" : "Intraday + Delivery";
}

function buildMessage(entry: RiskLogEntry): string {
  const watch = watchLabel(entry.broker);
  const fmt = formatRupee;
  switch (entry.type) {
    case "SessionStarted":
      return `Risk engine active — PnL ${fmt(entry.mtm)} | SL ${fmt(entry.sl ?? 0)} | Target ${fmt(entry.target ?? 0)} [${watch}]`;
    case "HardSlHit":
      return `Hard SL hit — PnL ${fmt(entry.mtm)}${entry.sl != null ? ` ≤ SL ${fmt(entry.sl)}` : ""} [${watch}]`;
    case "TargetHit":
      return `Target hit — PnL ${fmt(entry.mtm)}${entry.target != null ? ` ≥ ${fmt(entry.target)}` : ""} [${watch}]`;
    case "TslActivated":
      return `TSL activated — floor locked at ${entry.tslFloor != null ? fmt(entry.tslFloor) : "—"} [${watch}]`;
    case "TslRaised":
      return `TSL raised — new floor ${entry.tslFloor != null ? fmt(entry.tslFloor) : "—"} [${watch}]`;
    case "TslHit":
      return `TSL hit — PnL ${fmt(entry.mtm)}${entry.tslFloor != null ? ` ≤ floor ${fmt(entry.tslFloor)}` : ""} [${watch}]`;
    case "SquareOffComplete":
      return `Square-off complete — ${watch} positions exited (PnL ${fmt(entry.mtm)}) [${watch}]`;
    case "SquareOffFailed":
      return `Square-off FAILED — manual verification required [${watch}]`;
    case "AutoShiftTriggered":
      return `Auto-shifted ${entry.instrumentToken ?? "position"} — shift #${entry.shiftCount ?? ""} [${watch}]`;
    case "AutoShiftExhausted":
      return `Max auto-shifts reached for ${entry.instrumentToken ?? "position"} — position exited [${watch}]`;
    case "AutoShiftFailed":
      return `Auto-shift FAILED for ${entry.instrumentToken ?? "position"} — manual check required [${watch}]`;
    case "AutoSquareOff":
      return `Auto square-off — time limit reached (PnL ${fmt(entry.mtm)}) [${watch}]`;
    case "StatusUpdate":
      if (entry.tslFloor != null)
        return `PnL ${fmt(entry.mtm)} | TSL floor ${fmt(entry.tslFloor)} | Target ${fmt(entry.target ?? 0)} [${watch}]`;
      return `PnL ${fmt(entry.mtm)} | SL ${fmt(entry.sl ?? 0)} | Target ${fmt(entry.target ?? 0)} [${watch}]`;
    default:
      return `Risk engine event [${watch}]`;
  }
}

function rowColor(type: RiskNotificationType): string {
  switch (type) {
    case "HardSlHit":
    case "TslHit":
    case "SquareOffFailed":
    case "AutoShiftExhausted":
    case "AutoShiftFailed":
      return "text-rose-400";
    case "TargetHit":
    case "SquareOffComplete":
    case "TslActivated":
    case "TslRaised":
      return "text-emerald-400";
    case "AutoSquareOff":
    case "AutoShiftTriggered":
      return "text-yellow-400";
    default:
      return "text-muted-foreground";
  }
}

function Chip({ active, label, tooltip }: { active: boolean; label: string; tooltip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex cursor-default items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none",
            active
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-muted/40 text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              active ? "bg-emerald-400" : "bg-muted-foreground/40",
            )}
          />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px] text-center text-[11px]">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function BrokerStatusSection() {
  const configs = useProfitProtectionStore((s) => s.configs);
  const credentials = useBrokerStore((s) => s.credentials);

  const activeBrokers = BROKERS.filter((b) => !!credentials[b.id]?.accessToken);

  if (activeBrokers.length === 0) return null;

  return (
    <TooltipProvider delayDuration={300}>
    <div className="shrink-0 border-b border-border/40 px-3 py-1.5 space-y-1.5">
      {activeBrokers.map((broker) => {
        const cfg = configs[broker.id];
        const riskOn = cfg?.enabled ?? false;
        const autoShift = cfg?.autoShiftEnabled ?? false;
        const trailing = cfg?.trailingEnabled ?? false;
        const watch = cfg?.watchedProducts ?? "All";
        const watchLabel =
          watch === "Intraday" ? "· Profit protection on intraday positions only" :
          watch === "Delivery" ? "· Profit protection on delivery positions only" :
          "· Profit protection on all positions";

        return (
          <div key={broker.id} className="flex items-center gap-2">
            <BrokerBadge brokerId={broker.id} size={14} />
            <span className="text-[11px] font-medium text-foreground shrink-0">{broker.name}</span>
            <span className="text-[10px] text-muted-foreground">{watchLabel}</span>
            <div className="flex items-center gap-1 ml-auto">
              <Chip
                active={riskOn}
                label="Risk"
                tooltip={riskOn ? "Risk engine is active — monitoring MTM SL and target" : "Risk engine is off — no automatic exits will trigger"}
              />
              <Chip
                active={trailing}
                label="TSL"
                tooltip={trailing ? "Trailing stop-loss is enabled — floor rises as profit increases" : "Trailing stop-loss is disabled"}
              />
              <Chip
                active={autoShift}
                label="Auto-shift"
                tooltip={autoShift ? "Auto-shift is enabled — positions shift to a further strike when LTP rises past the threshold" : "Auto-shift is disabled"}
              />
            </div>
          </div>
        );
      })}
    </div>
    </TooltipProvider>
  );
}

export function RiskActivityLog() {
  const { entries, loaded, setAll } = useRiskLogStore();

  useEffect(() => {
    if (loaded) return;
    const token = useAuthStore.getState().token;
    if (!token) return;

    fetch(`${API_BASE_URL}/api/risk-log`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) { setAll([]); return; }
        const data = await r.json();
        setAll(Array.isArray(data) ? data : []);
      })
      .catch(() => setAll([]));
  }, [loaded, setAll]);

  return (
    <div className="flex h-full flex-col">
      {/* Broker status cards */}
      <BrokerStatusSection />

      {/* Log rows */}
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Inbox className="size-6 opacity-40" />
            <p className="text-xs">No risk engine activity today</p>
          </div>
        ) : (
          entries.map((entry, i) => (
            <div
              key={entry.id !== 0 ? entry.id : `${entry.timestamp}-${i}`}
              className="flex items-center gap-2 border-b border-border/20 px-3 py-1"
            >
              <span className="w-20 shrink-0 whitespace-nowrap font-mono tabular-nums text-[11px] text-muted-foreground">
                {formatTime(entry.timestamp)}
              </span>
              <BrokerBadge brokerId={entry.broker} size={13} />
              <span className={cn("flex-1 text-[11px]", rowColor(entry.type))}>
                {buildMessage(entry)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
