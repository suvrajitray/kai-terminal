import { useEffect } from "react";
import { motion } from "motion/react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { BROKERS } from "@/lib/constants";
import { BrokerCard } from "@/components/brokers/broker-card";
import { useBrokerStore } from "@/stores/broker-store";
import { fetchBrokerCredentials } from "@/services/broker-api";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { cn } from "@/lib/utils";

type BrokerStatus = "active" | "expired" | "missing";

function getBrokerStatus(
  isConnected: (id: string) => boolean,
  getCredentials: (id: string) => { accessToken?: string } | undefined,
  brokerId: string,
): BrokerStatus {
  if (!isConnected(brokerId)) return "missing";
  const token = getCredentials(brokerId)?.accessToken;
  if (isBrokerTokenExpired(brokerId, token)) return token ? "expired" : "missing";
  return "active";
}

export function ConnectBrokersPage() {
  const saveCredentials  = useBrokerStore((s) => s.saveCredentials);
  const getCredentials   = useBrokerStore((s) => s.getCredentials);
  const isConnected      = useBrokerStore((s) => s.isConnected);

  useEffect(() => {
    fetchBrokerCredentials()
      .then((credentials) => {
        for (const cred of credentials) {
          saveCredentials(cred.brokerName, {
            apiKey: cred.apiKey,
            apiSecret: cred.apiSecret,
            redirectUrl: `${window.location.origin}/redirect/${cred.brokerName}`,
            accessToken: getCredentials(cred.brokerName)?.accessToken,
          });
        }
      })
      .catch(() => {
        // silently ignore — store may already have persisted data
      });
  }, [saveCredentials]);

  // Only care about brokers that have been set up (have API credentials)
  const connectedBrokers = BROKERS.filter((b) => isConnected(b.id));

  const statuses = connectedBrokers.map((b) => ({
    broker: b,
    status: getBrokerStatus(isConnected, getCredentials, b.id),
  }));

  const anyNeedsReAuth = statuses.some((s) => s.status !== "active");
  const multipleConnected = connectedBrokers.length > 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Connect Brokers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {anyNeedsReAuth
            ? "Authenticate your broker to start trading."
            : "Link your brokerage accounts to start trading."}
        </p>
      </div>

      {anyNeedsReAuth && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {multipleConnected ? (
            // Multi-broker: per-broker status rows
            <div className="flex flex-col gap-2">
              {statuses.map(({ broker, status }) => {
                const isOk = status === "active";
                return (
                  <div
                    key={broker.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm",
                      isOk
                        ? "border-green-500/30 bg-green-500/10"
                        : "border-amber-500/30 bg-amber-500/10",
                    )}
                  >
                    {isOk ? (
                      <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                    ) : (
                      <AlertCircle className="size-4 shrink-0 text-amber-500" />
                    )}
                    <div className="flex items-baseline gap-2">
                      <span className={cn("font-medium", isOk ? "text-green-500" : "text-amber-500")}>
                        {broker.name}
                      </span>
                      <span className="text-muted-foreground">
                        {isOk
                          ? "Session active"
                          : status === "expired"
                            ? "Session expired — re-authenticate below to resume trading."
                            : "Not authenticated — authenticate below to start trading."}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Single broker: same row style, no need for separate layout
            <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
              <AlertCircle className="size-4 shrink-0 text-amber-500" />
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-amber-500">
                  {statuses[0]?.broker.name}
                </span>
                <span className="text-muted-foreground">
                  {statuses[0]?.status === "expired"
                    ? "Session expired — re-authenticate below to resume trading."
                    : "Not authenticated — authenticate below to start trading."}
                </span>
              </div>
            </div>
          )}
        </motion.div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BROKERS.map((broker, i) => (
          <motion.div
            key={broker.id}
            className="h-full"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <BrokerCard broker={broker} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
