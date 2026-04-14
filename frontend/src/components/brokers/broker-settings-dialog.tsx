import { useReducer } from "react";
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
import { saveBrokerCredential, deleteBrokerCredential } from "@/services/broker-api";
import type { BrokerInfo } from "@/types";

interface SettingsFormState {
  apiKey: string;
  apiSecret: string;
  copiedRedirect: boolean;
  copiedWebhook: boolean;
  saving: boolean;
  disconnecting: boolean;
  error: string | null;
}

type SettingsFormAction =
  | { type: "SET_API_KEY"; value: string }
  | { type: "SET_API_SECRET"; value: string }
  | { type: "SET_COPIED_REDIRECT"; copied: boolean }
  | { type: "SET_COPIED_WEBHOOK"; copied: boolean }
  | { type: "SET_SAVING"; saving: boolean }
  | { type: "SET_DISCONNECTING"; disconnecting: boolean }
  | { type: "SET_ERROR"; error: string | null };

function settingsFormReducer(state: SettingsFormState, action: SettingsFormAction): SettingsFormState {
  switch (action.type) {
    case "SET_API_KEY":         return { ...state, apiKey: action.value };
    case "SET_API_SECRET":      return { ...state, apiSecret: action.value };
    case "SET_COPIED_REDIRECT": return { ...state, copiedRedirect: action.copied };
    case "SET_COPIED_WEBHOOK":  return { ...state, copiedWebhook: action.copied };
    case "SET_SAVING":          return { ...state, saving: action.saving };
    case "SET_DISCONNECTING":   return { ...state, disconnecting: action.disconnecting };
    case "SET_ERROR":           return { ...state, error: action.error };
    default: return state;
  }
}

interface BrokerSettingsDialogProps {
  broker: BrokerInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrokerSettingsDialog({ broker, open, onOpenChange }: BrokerSettingsDialogProps) {
  const credentials = useBrokerStore((s) => s.credentials[broker.id]);
  const saveCredentials = useBrokerStore((s) => s.saveCredentials);
  const removeCredentials = useBrokerStore((s) => s.removeCredentials);
  const [form, dispatch] = useReducer(settingsFormReducer, {
    apiKey:        credentials?.apiKey ?? "",
    apiSecret:     credentials?.apiSecret ?? "",
    copiedRedirect: false,
    copiedWebhook:  false,
    saving:         false,
    disconnecting:  false,
    error:          null,
  });
  const { apiKey, apiSecret, copiedRedirect, copiedWebhook, saving, disconnecting, error } = form;

  const redirectUrl = `${window.location.origin}${broker.redirectPath}`;
  const webhookUrl = broker.id === "upstox"
    ? `${window.location.origin}/api/webhooks/upstox/order/${apiKey || "YOUR_API_KEY"}`
    : `${window.location.origin}/api/webhooks/${broker.id}/order?apiKey=${apiKey || "YOUR_API_KEY"}`;

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

  const handleSave = async (e: React.FormEvent) => {
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
      onOpenChange(false);
    } catch {
      dispatch({ type: "SET_ERROR", error: "Failed to save. Please try again." });
    } finally {
      dispatch({ type: "SET_SAVING", saving: false });
    }
  };

  const handleDisconnect = async () => {
    dispatch({ type: "SET_DISCONNECTING", disconnecting: true });
    dispatch({ type: "SET_ERROR", error: null });
    try {
      await deleteBrokerCredential(broker.id);
      removeCredentials(broker.id);
      onOpenChange(false);
    } catch {
      dispatch({ type: "SET_ERROR", error: "Failed to disconnect. Please try again." });
    } finally {
      dispatch({ type: "SET_DISCONNECTING", disconnecting: false });
    }
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
              onChange={(e) => dispatch({ type: "SET_API_KEY", value: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-api-secret">API Secret</Label>
            <Input
              id="settings-api-secret"
              type="password"
              placeholder="Enter your API secret"
              value={apiSecret}
              onChange={(e) => dispatch({ type: "SET_API_SECRET", value: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-redirect-url">Redirect URL</Label>
            <div className="flex gap-2">
              <Input id="settings-redirect-url" value={redirectUrl} readOnly className="text-muted-foreground" />
              <Button type="button" variant="outline" size="icon" onClick={handleCopyRedirect}>
                {copiedRedirect ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-webhook-url">Webhook URL</Label>
            <div className="flex gap-2">
              <Input id="settings-webhook-url" value={webhookUrl} readOnly className="text-muted-foreground font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={handleCopyWebhook}>
                {copiedWebhook ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnecting || saving}
            >
              <Trash2 className="mr-2 size-4" />
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!apiKey.trim() || !apiSecret.trim() || saving || disconnecting}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
