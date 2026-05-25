import { useState, useEffect } from "react";
import { useBrokerStore } from "@/stores/broker-store";
import { useUserTradingSettingsStore } from "@/stores/user-trading-settings-store";
import { BROKERS } from "@/lib/constants";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { putDefaultFirst } from "@/lib/broker-utils";
import type { SupportedBroker } from "@/components/panels/order-dialog-parts/types";

export function useBasketBroker() {
  const credentials  = useBrokerStore((s) => s.credentials);
  const defaultBroker = useUserTradingSettingsStore((s) => s.defaultBroker);

  const activeBrokers = putDefaultFirst(
    BROKERS.filter(
      (b) => (b.id === "upstox" || b.id === "zerodha") && !isBrokerTokenExpired(b.id, credentials[b.id]?.accessToken),
    ),
    defaultBroker,
  );

  const [broker, setBroker] = useState<SupportedBroker | undefined>(
    activeBrokers[0]?.id as SupportedBroker,
  );

  // Sync selected broker when credentials change while dialog is open
  useEffect(() => {
    if (!broker || !activeBrokers.some((b) => b.id === broker)) {
      setBroker(activeBrokers[0]?.id as SupportedBroker | undefined);
    }
  }, [credentials]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeBroker  = (broker ?? "upstox") as "upstox" | "zerodha";
  const brokerLabel   = broker === "zerodha" ? "Zerodha" : "Upstox";

  return { broker, setBroker, activeBrokers, activeBroker, brokerLabel };
}
