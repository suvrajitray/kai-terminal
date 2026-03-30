import { useEffect } from "react";
import * as signalR from "@microsoft/signalr";
import { toast } from "@/lib/toast";
import { API_BASE_URL } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth-store";
import { useRiskStateStore } from "@/stores/risk-state-store";
import type { RiskEvent } from "@/types";

function formatRupee(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return value >= 0 ? `₹+${formatted}` : `₹-${formatted}`;
}

function buildToastMessage(event: RiskEvent): string {
  switch (event.type) {
    case "SessionStarted":
      return `Risk engine active — watching ${event.openPositionCount} open position(s) (PnL ${formatRupee(event.mtm)})`;
    case "HardSlHit":
      return `Hard SL Hit — PnL ${formatRupee(event.mtm)}${event.sl != null ? ` ≤ SL ${formatRupee(event.sl)}` : ""}`;
    case "TargetHit":
      return `Target Hit — PnL ${formatRupee(event.mtm)}${event.target != null ? ` ≥ ${formatRupee(event.target)}` : ""}`;
    case "TslActivated":
      return `TSL Activated — floor locked at ${event.tslFloor != null ? formatRupee(event.tslFloor) : "—"}`;
    case "TslRaised":
      return `TSL Raised — new floor ${event.tslFloor != null ? formatRupee(event.tslFloor) : "—"}`;
    case "TslHit":
      return `TSL Hit — PnL ${formatRupee(event.mtm)}${event.tslFloor != null ? ` ≤ floor ${formatRupee(event.tslFloor)}` : ""}`;
    case "SquareOffComplete":
      return `Square-off complete — all positions exited (PnL ${formatRupee(event.mtm)})`;
    case "SquareOffFailed":
      return `Square-off FAILED — manual verification required`;
    case "AutoShiftTriggered":
      return `Auto-shifted ${event.instrumentToken ?? "position"} — shift #${event.shiftCount ?? ""}`;
    case "AutoShiftExhausted":
      return `Max auto-shifts reached for ${event.instrumentToken ?? "position"} — position exited`;
    default:
      return "Risk engine event";
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

      // Toast notifications
      const message = buildToastMessage(event);
      switch (event.type) {
        case "HardSlHit":
        case "TslHit":
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
          toast.warning(message, { duration: 10000 });
          break;
      }
    });

    conn.start().catch(() => {});

    return () => { conn.stop(); };
  }, []);
}
