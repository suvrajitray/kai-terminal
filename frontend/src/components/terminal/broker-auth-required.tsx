import { ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface BrokerAuthRequiredProps {
  expired: boolean;
}

export function BrokerAuthRequired({ expired }: BrokerAuthRequiredProps) {
  const navigate = useNavigate();

  return (
    <div className="relative flex h-[calc(100svh-3.5rem)] items-center justify-center overflow-hidden">

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-destructive/5 blur-[140px]" />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-border/50 bg-card/60 p-8 text-center shadow-xl shadow-black/20 backdrop-blur-md">
        <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 ring-1 ring-destructive/20">
          <ShieldAlert className="size-5 text-destructive" />
        </div>
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
