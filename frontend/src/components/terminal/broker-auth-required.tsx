import { ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface BrokerAuthRequiredProps {
  expired: boolean;
}

export function BrokerAuthRequired({ expired }: BrokerAuthRequiredProps) {
  const navigate = useNavigate();

  return (
    <div className="flex h-[calc(100svh-3.5rem)] items-center justify-center">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center shadow-sm max-w-sm w-full">
        <ShieldAlert className="size-10 text-destructive" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {expired ? "Token Expired" : "No Broker Token"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {expired
              ? "Your broker token has expired — please re-authenticate."
              : "No broker token found — please authenticate with your broker first."}
          </p>
        </div>
        <Button onClick={() => navigate("/connect-brokers")}>Connect Broker</Button>
      </div>
    </div>
  );
}
