import { useState } from "react";
import { Copy, Check, Trash2 } from "lucide-react";
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

interface BrokerSettingsDialogProps {
  broker: BrokerInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrokerSettingsDialog({ broker, open, onOpenChange }: BrokerSettingsDialogProps) {
  const credentials = useBrokerStore((s) => s.credentials[broker.id]);
  const saveCredentials = useBrokerStore((s) => s.saveCredentials);
  const removeCredentials = useBrokerStore((s) => s.removeCredentials);
  const [apiKey, setApiKey] = useState(credentials?.apiKey ?? "");
  const [apiSecret, setApiSecret] = useState(credentials?.apiSecret ?? "");
  const [copied, setCopied] = useState(false);

  const redirectUrl = `${window.location.origin}${broker.redirectPath}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(redirectUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !apiSecret.trim()) return;

    saveCredentials(broker.id, {
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      redirectUrl,
    });
    onOpenChange(false);
  };

  const handleDisconnect = () => {
    removeCredentials(broker.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="size-3 rounded-full" style={{ backgroundColor: broker.color }} />
            {broker.name} Settings
          </DialogTitle>
          <DialogDescription>
            Update your {broker.name} API credentials or disconnect.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-api-key">API Key</Label>
            <Input
              id="settings-api-key"
              placeholder="Enter your API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-api-secret">API Secret</Label>
            <Input
              id="settings-api-secret"
              type="password"
              placeholder="Enter your API secret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-redirect-url">Redirect URL</Label>
            <div className="flex gap-2">
              <Input id="settings-redirect-url" value={redirectUrl} readOnly className="text-muted-foreground" />
              <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button type="button" variant="destructive" onClick={handleDisconnect}>
              <Trash2 className="mr-2 size-4" />
              Disconnect
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!apiKey.trim() || !apiSecret.trim()}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
