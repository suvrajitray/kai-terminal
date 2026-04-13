import { useEffect } from "react";
import * as signalR from "@microsoft/signalr";
import { toast } from "@/lib/toast";
import { API_BASE_URL } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth-store";
import { useRiskStateStore } from "@/stores/risk-state-store";
import { useRiskLogStore } from "@/stores/risk-log-store";
import type { RiskEvent } from "@/types";

function formatRupee(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return value >= 0 ? `₹+${formatted}` : `₹-${formatted}`;
}

function brokerLabel(broker: string): string {
  return broker.charAt(0).toUpperCase() + broker.slice(1).toLowerCase();
}


function buildToastMessage(event: RiskEvent): string {
  const broker = brokerLabel(event.broker);
  switch (event.type) {
    case "SessionStarted":
      return `[${broker}] Risk engine active — watching ${event.openPositionCount} open position(s) (PnL ${formatRupee(event.mtm)})`;
    case "HardSlHit":
      return `[${broker}] Hard SL Hit — PnL ${formatRupee(event.mtm)}${event.sl != null ? ` ≤ SL ${formatRupee(event.sl)}` : ""}`;
    case "TargetHit":
      return `[${broker}] Target Hit — PnL ${formatRupee(event.mtm)}${event.target != null ? ` ≥ ${formatRupee(event.target)}` : ""}`;
    case "TslActivated":
      return `[${broker}] TSL Activated — profit locked at ${event.tslFloor != null ? formatRupee(event.tslFloor) : "—"}`;
    case "TslRaised":
      return `[${broker}] TSL Raised — new floor ${event.tslFloor != null ? formatRupee(event.tslFloor) : "—"}`;
    case "TslHit":
      return `[${broker}] TSL Hit — PnL ${formatRupee(event.mtm)}${event.tslFloor != null ? ` ≤ floor ${formatRupee(event.tslFloor)}` : ""}`;
    case "SquareOffComplete":
      return `[${broker}] Square-off complete — positions exited (PnL ${formatRupee(event.mtm)})`;
    case "SquareOffFailed":
      return `[${broker}] Square-off FAILED — manual verification required`;
    case "AutoShiftTriggered":
      return `[${broker}] Auto-shifted ${event.instrumentToken ?? "position"} — shift #${event.shiftCount ?? ""}`;
    case "AutoShiftExhausted":
      return `[${broker}] Max auto-shifts reached for ${event.instrumentToken ?? "position"} — position exited`;
    case "AutoShiftFailed":
      return `[${broker}] Auto-shift FAILED for ${event.instrumentToken ?? "position"} — manual check required`;
    case "AutoSquareOff":
      return `[${broker}] Auto square-off — time limit reached (PnL ${formatRupee(event.mtm)})`;
    default:
      return `[${broker}] Risk engine event`;
  }
}

export function useRiskFeed(): void {
  useEffect(() => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/risk`, {
        accessTokenFactory: () => useAuthStore.getState().token ?? "",
      })
      .withAutomaticReconnect()
      .build();

    conn.on("ReceiveRiskEvent", (event: RiskEvent) => {
      const store = useRiskStateStore.getState();

      // Update TSL display state
      if (event.type === "TslActivated" && event.tslFloor != null)
        store.setTslActivated(event.broker, event.tslFloor);
      else if (event.type === "TslRaised" && event.tslFloor != null)
        store.setTslRaised(event.broker, event.tslFloor);
      else if (event.type === "TslHit" || event.type === "HardSlHit" || event.type === "TargetHit" || event.type === "SquareOffComplete")
        store.resetTsl(event.broker);

      // Append to risk log store
      useRiskLogStore.getState().prepend({
        id:              0,  // sentinel — no DB id on real-time events
        timestamp:       event.timestamp,
        broker:          event.broker,
        type:            event.type,
        mtm:             event.mtm,
        target:          event.target,
        sl:              event.sl,
        tslFloor:        event.tslFloor,
        instrumentToken: event.instrumentToken,
        shiftCount:      event.shiftCount,
      });

      // Toast notifications (StatusUpdate is silent)
      if (event.type === "StatusUpdate") return;

      const message = buildToastMessage(event);
      switch (event.type) {
        case "HardSlHit":
        case "TslHit":
          toast.warning(message, { duration: 10000 });
          break;
        case "SquareOffFailed":
          toast.error(message, { duration: 10000 });
          break;
        case "TargetHit":
        case "SquareOffComplete":
          toast.success(message, { duration: 10000 });
          break;
        case "SessionStarted":
        case "TslActivated":
        case "TslRaised":
        case "AutoShiftTriggered":
          toast.info(message, { duration: 8000 });
          break;
        case "AutoShiftExhausted":
        case "AutoSquareOff":
          toast.warning(message, { duration: 10000 });
          break;
        case "AutoShiftFailed":
          toast.error(message, { duration: 10000 });
          break;
      }
    });

    conn.start().catch(() => {});

    return () => { conn.stop(); };
  }, []);
}
