import { useBrokerStore } from "@/stores/broker-store";
import { isTokenExpired } from "@/lib/token-utils";
import { BrokerAuthRequired } from "@/components/terminal/broker-auth-required";
import { ChartsPanel } from "@/components/panels/charts-panel";

export function ChartsPage() {
  const token = useBrokerStore((s) => s.getCredentials("upstox")?.accessToken);
  if (!token || isTokenExpired(token)) {
    return <BrokerAuthRequired expired={!!token} />;
  }

  return (
    <div className="relative flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">
      <ChartsPanel />
    </div>
  );
}
