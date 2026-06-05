import { isBrokerTokenExpired } from "@/lib/token-utils";
import { useBrokerStore } from "@/stores/broker-store";
import { toast } from "@/lib/toast";

/**
 * Imperative check: is at least one broker connected with a non-expired token?
 * Reads the store directly so it can be called from event handlers.
 */
export function hasValidBrokerNow(): boolean {
  const { credentials } = useBrokerStore.getState();
  return Object.entries(credentials).some(
    ([id, c]) => !isBrokerTokenExpired(id, c?.accessToken),
  );
}

/**
 * Guard for order-placement actions. Returns true when a broker is available.
 * When none is available, shows an actionable toast linking to /connect-brokers
 * and returns false so the caller can bail out.
 */
export function ensureBrokerOrPrompt(): boolean {
  if (hasValidBrokerNow()) return true;
  toast.warning("Connect a broker to place orders", {
    action: {
      label: "Connect",
      onClick: () => {
        window.location.href = "/connect-brokers";
      },
    },
  });
  return false;
}
