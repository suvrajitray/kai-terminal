import { BROKERS } from "@/lib/constants";
import { BrokerCard } from "@/mobile/components/broker-card";

export function MobileBrokersPage() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="mb-1">
        <h1 className="text-base font-semibold text-foreground">Brokers</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Connect and authenticate your broker accounts.
        </p>
      </div>

      {BROKERS.map((broker) => (
        <BrokerCard key={broker.id} broker={broker} />
      ))}
    </div>
  );
}
