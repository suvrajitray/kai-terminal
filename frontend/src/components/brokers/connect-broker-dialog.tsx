import { useReducer } from "react";
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
import { saveBrokerCredential } from "@/services/broker-api";
import type { BrokerInfo } from "@/types";

interface ConnectFormState {
  apiKey: string;
  apiSecret: string;
  copiedRedirect: boolean;
  copiedWebhook: boolean;
  saving: boolean;
  error: string | null;
}

type ConnectFormAction =
  | { type: "SET_API_KEY"; value: string }
  | { type: "SET_API_SECRET"; value: string }
  | { type: "SET_COPIED_REDIRECT"; copied: boolean }
  | { type: "SET_COPIED_WEBHOOK"; copied: boolean }
  | { type: "SET_SAVING"; saving: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" };

function connectFormReducer(state: ConnectFormState, action: ConnectFormAction): ConnectFormState {
  switch (action.type) {
    case "SET_API_KEY":         return { ...state, apiKey: action.value };
    case "SET_API_SECRET":      return { ...state, apiSecret: action.value };
    case "SET_COPIED_REDIRECT": return { ...state, copiedRedirect: action.copied };
    case "SET_COPIED_WEBHOOK":  return { ...state, copiedWebhook: action.copied };
    case "SET_SAVING":          return { ...state, saving: action.saving };
    case "SET_ERROR":           return { ...state, error: action.error };
    case "RESET":               return { apiKey: "", apiSecret: "", copiedRedirect: false, copiedWebhook: false, saving: false, error: null };
    default: return state;
  }
}

interface ConnectBrokerDialogProps {
  broker: BrokerInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectBrokerDialog({ broker, open, onOpenChange }: ConnectBrokerDialogProps) {
  const saveCredentials = useBrokerStore((s) => s.saveCredentials);
  const [form, dispatch] = useReducer(connectFormReducer, { apiKey: "", apiSecret: "", copiedRedirect: false, copiedWebhook: false, saving: false, error: null });
  const { apiKey, apiSecret, copiedRedirect, copiedWebhook, saving, error } = form;

  const redirectUrl = `${window.location.origin}${broker.redirectPath}`;
  const webhookUrl = `${window.location.origin}/api/webhooks/${broker.id}/order?apiKey=${apiKey || "YOUR_API_KEY"}`;

  const handleCopyRedirect = async () => {
    await navigator.clipboard.writeText(redirectUrl);
    dispatch({ type: "SET_COPIED_REDIRECT", copied: true });
    setTimeout(() => dispatch({ type: "SET_COPIED_REDIRECT", copied: false }), 2000);
  };

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    dispatch({ type: "SET_COPIED_WEBHOOK", copied: true });
    setTimeout(() => dispatch({ type: "SET_COPIED_WEBHOOK", copied: false }), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !apiSecret.trim()) return;

    dispatch({ type: "SET_SAVING", saving: true });
    dispatch({ type: "SET_ERROR", error: null });
    try {
      await saveBrokerCredential(broker.id, apiKey.trim(), apiSecret.trim());
      saveCredentials(broker.id, {
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
        redirectUrl,
      });
      dispatch({ type: "RESET" });
      onOpenChange(false);
    } catch {
      dispatch({ type: "SET_ERROR", error: "Failed to save. Please try again." });
    } finally {
      dispatch({ type: "SET_SAVING", saving: false });
    }
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
              onChange={(e) => dispatch({ type: "SET_API_KEY", value: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-secret">API Secret</Label>
            <Input
              id="api-secret"
              type="password"
              placeholder="Enter your API secret"
              value={apiSecret}
              onChange={(e) => dispatch({ type: "SET_API_SECRET", value: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="redirect-url">Redirect URL</Label>
            <div className="flex gap-2">
              <Input id="redirect-url" value={redirectUrl} readOnly className="text-muted-foreground" />
              <Button type="button" variant="outline" size="icon" onClick={handleCopyRedirect}>
                {copiedRedirect ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Set this as the redirect URL in your {broker.name} app settings.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <div className="flex gap-2">
              <Input id="webhook-url" value={webhookUrl} readOnly className="text-muted-foreground font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={handleCopyWebhook}>
                {copiedWebhook ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Set this as the postback URL in your {broker.name} app settings for instant order notifications.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!apiKey.trim() || !apiSecret.trim() || saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
