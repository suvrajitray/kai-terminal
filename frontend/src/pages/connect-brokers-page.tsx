import { useEffect } from "react";
import { motion } from "motion/react";
import { BROKERS } from "@/lib/constants";
import { BrokerCard } from "@/components/brokers/broker-card";
import { useBrokerStore } from "@/stores/broker-store";
import { fetchBrokerCredentials } from "@/services/broker-api";

export function ConnectBrokersPage() {
  const saveCredentials = useBrokerStore((s) => s.saveCredentials);

  useEffect(() => {
    fetchBrokerCredentials()
      .then((credentials) => {
        for (const cred of credentials) {
          saveCredentials(cred.brokerName, {
            apiKey: cred.apiKey,
            apiSecret: cred.apiSecret,
            redirectUrl: `${window.location.origin}/redirect/${cred.brokerName}`,
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
          Link your brokerage accounts to start trading.
        </p>
      </div>
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
