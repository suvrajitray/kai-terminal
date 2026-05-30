import { useState } from "react";
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

  // Honor the user's last pick if it's still active; otherwise fall back to the
  // first active broker (which respects the default ordering).
  const [userBroker, setBroker] = useState<SupportedBroker | undefined>();
  const broker = (userBroker && activeBrokers.some((b) => b.id === userBroker))
    ? userBroker
    : (activeBrokers[0]?.id as SupportedBroker | undefined);

  const activeBroker  = (broker ?? "upstox") as "upstox" | "zerodha";
  const brokerLabel   = broker === "zerodha" ? "Zerodha" : "Upstox";

  return { broker, setBroker, activeBrokers, activeBroker, brokerLabel };
}
