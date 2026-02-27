import { useState } from "react";
import { Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useBrokerStore } from "@/stores/broker-store";
import type { BrokerInfo } from "@/types";

interface ConnectBrokerDialogProps {
  broker: BrokerInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectBrokerDialog({ broker, open, onOpenChange }: ConnectBrokerDialogProps) {
  const saveCredentials = useBrokerStore((s) => s.saveCredentials);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [copied, setCopied] = useState(false);

  const redirectUrl = `${window.location.origin}${broker.redirectPath}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(redirectUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !apiSecret.trim()) return;

    saveCredentials(broker.id, {
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      redirectUrl,
    });
    setApiKey("");
    setApiSecret("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="size-3 rounded-full" style={{ backgroundColor: broker.color }} />
            Connect {broker.name}
          </DialogTitle>
          <DialogDescription>
            Enter your {broker.name} API credentials to connect your account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              placeholder="Enter your API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-secret">API Secret</Label>
            <Input
              id="api-secret"
              type="password"
              placeholder="Enter your API secret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="redirect-url">Redirect URL</Label>
            <div className="flex gap-2">
              <Input id="redirect-url" value={redirectUrl} readOnly className="text-muted-foreground" />
              <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Copy this URL and set it as the redirect URL in your {broker.name} app settings.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!apiKey.trim() || !apiSecret.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
