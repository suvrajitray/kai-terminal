import { useEffect } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrokerBadge } from "@/components/ui/broker-badge";
import { useRiskLogStore } from "@/stores/risk-log-store";
import { useAuthStore } from "@/stores/auth-store";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { API_BASE_URL } from "@/lib/constants";
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
      hour12: false,
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
      return `Risk engine active (PnL ${fmt(entry.mtm)}) [${watch}]`;
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
      return "text-red-400";
    case "TargetHit":
    case "SquareOffComplete":
    case "TslActivated":
    case "TslRaised":
      return "text-green-400";
    case "AutoSquareOff":
    case "AutoShiftTriggered":
      return "text-yellow-400";
    default:
      return "text-muted-foreground";
  }
}

export function RiskActivityLog() {
  const { entries, loaded, setAll, clear } = useRiskLogStore();

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
      {/* Sub-header */}
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-border/40 px-3">
        <span className="text-xs font-medium text-muted-foreground">Today's Activity</span>
        {entries.length > 0 && (
          <button
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={clear}
          >
            Clear view
          </button>
        )}
      </div>

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
              <span className="w-14 shrink-0 font-mono tabular-nums text-[11px] text-muted-foreground">
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
