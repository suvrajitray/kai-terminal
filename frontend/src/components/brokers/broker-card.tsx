import { useState } from "react";
import { motion } from "motion/react";
import { KeyRound, Settings, Plug } from "lucide-react";
import { CopyTokenButton } from "@/components/layout/copy-token-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConnectBrokerDialog } from "./connect-broker-dialog";
import { BrokerSettingsDialog } from "./broker-settings-dialog";
import { useBrokerStore } from "@/stores/broker-store";
import { UPSTOX_OAUTH_URL } from "@/lib/constants";
import type { BrokerInfo } from "@/types";

interface BrokerCardProps {
  broker: BrokerInfo;
}

export function BrokerCard({ broker }: BrokerCardProps) {
  const isConnected = useBrokerStore((s) => s.isConnected(broker.id));
  const getCredentials = useBrokerStore((s) => s.getCredentials);
  const [connectOpen, setConnectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleAuthenticate = () => {
    const creds = getCredentials(broker.id);
    if (!creds) return;
    const params = new URLSearchParams({
      response_type: "code",
      client_id: creds.apiKey,
      redirect_uri: creds.redirectUrl,
    });
    window.location.href = `${UPSTOX_OAUTH_URL}?${params.toString()}`;
  };

  return (
    <>
      <motion.div className="h-full" whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
        <Card className="flex h-full flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="size-3 rounded-full"
                  style={{ backgroundColor: broker.color }}
                />
                <CardTitle className="text-lg">{broker.name}</CardTitle>
              </div>
              {isConnected && (
                <Badge variant="secondary" className="text-xs">
                  Connected
                </Badge>
              )}
            </div>
            <CardDescription className="pt-1">{broker.description}</CardDescription>
          </CardHeader>
          <CardContent className="mt-auto space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {broker.features.map((feature) => (
                <Badge key={feature} variant="secondary" className="text-xs">
                  {feature}
                </Badge>
              ))}
            </div>
            {isConnected ? (
              <div className="flex gap-2">
                <Button className="flex-1" variant="default" onClick={handleAuthenticate}>
                  <KeyRound className="mr-2 size-4" />
                  Authenticate
                </Button>
                <CopyTokenButton brokerId={broker.id} />
                <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)}>
                  <Settings className="size-4" />
                </Button>
              </div>
            ) : (
              <Button
                className="w-full text-white hover:opacity-90"
                style={{ backgroundColor: broker.color }}
                onClick={() => setConnectOpen(true)}
              >
                <Plug className="mr-2 size-4" />
                Connect
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <ConnectBrokerDialog broker={broker} open={connectOpen} onOpenChange={setConnectOpen} />
      <BrokerSettingsDialog broker={broker} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
