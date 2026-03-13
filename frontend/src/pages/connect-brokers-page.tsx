import { useEffect } from "react";
import { motion } from "motion/react";
import { AlertCircle } from "lucide-react";
import { BROKERS } from "@/lib/constants";
import { BrokerCard } from "@/components/brokers/broker-card";
import { useBrokerStore } from "@/stores/broker-store";
import { fetchBrokerCredentials } from "@/services/broker-api";

export function ConnectBrokersPage() {
  const saveCredentials  = useBrokerStore((s) => s.saveCredentials);
  const getCredentials   = useBrokerStore((s) => s.getCredentials);
  const isConnected      = useBrokerStore((s) => s.isConnected);
  const isAuthenticated  = useBrokerStore((s) => s.isAuthenticated);

  // True if at least one broker is set up (has API key) but no active session token
  const needsReAuth = BROKERS.some((b) => isConnected(b.id) && !isAuthenticated(b.id));

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Connect Brokers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {needsReAuth
            ? "Authenticate your broker to start trading."
            : "Link your brokerage accounts to start trading."}
        </p>
      </div>

      {needsReAuth && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium text-amber-500">Session expired</p>
            <p className="mt-0.5 text-muted-foreground">
              Your broker session has expired. Re-authenticate below to resume trading.
            </p>
          </div>
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
