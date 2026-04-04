import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useUserTradingSettingsStore } from "@/stores/user-trading-settings-store";
import { saveUserTradingSettings, type UserTradingSettings } from "@/services/user-settings-api";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHIFT_FIELDS: { key: keyof UserTradingSettings; label: string }[] = [
  { key: "niftyShiftOffset", label: "NIFTY" },
  { key: "sensexShiftOffset", label: "SENSEX" },
  { key: "bankniftyShiftOffset", label: "BANKNIFTY" },
  { key: "finniftyShiftOffset", label: "FINNIFTY" },
  { key: "bankexShiftOffset", label: "BANKEX" },
];

export function UserTradingSettingsDialog({ open, onClose }: Props) {
  const store = useUserTradingSettingsStore();
  const [draft, setDraft] = useState<UserTradingSettings>(() => ({
    niftyShiftOffset: store.niftyShiftOffset,
    sensexShiftOffset: store.sensexShiftOffset,
    bankniftyShiftOffset: store.bankniftyShiftOffset,
    finniftyShiftOffset: store.finniftyShiftOffset,
    bankexShiftOffset: store.bankexShiftOffset,
    indexChangeMode: store.indexChangeMode,
    autoSquareOffEnabled: store.autoSquareOffEnabled,
    autoSquareOffTime: store.autoSquareOffTime,
  }));
  const [saving, setSaving] = useState(false);

  // Sync draft from store each time dialog opens
  useEffect(() => {
    if (!open) return;
    setDraft({
      niftyShiftOffset: store.niftyShiftOffset,
      sensexShiftOffset: store.sensexShiftOffset,
      bankniftyShiftOffset: store.bankniftyShiftOffset,
      finniftyShiftOffset: store.finniftyShiftOffset,
      bankexShiftOffset: store.bankexShiftOffset,
      indexChangeMode: store.indexChangeMode,
      autoSquareOffEnabled: store.autoSquareOffEnabled,
      autoSquareOffTime: store.autoSquareOffTime,
    });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: keyof UserTradingSettings, value: number) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveUserTradingSettings(draft);
      store.setSettings(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-4" />
            User Trading Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-1">
          {/* Index Change Mode */}
          <div className="space-y-1.5">
            <Label>Index Change Display</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={draft.indexChangeMode === "prevClose" ? "default" : "outline"}
                onClick={() => setDraft((d) => ({ ...d, indexChangeMode: "prevClose" }))}
              >
                From Prev Close
              </Button>
              <Button
                type="button"
                size="sm"
                variant={draft.indexChangeMode === "open" ? "default" : "outline"}
                onClick={() => setDraft((d) => ({ ...d, indexChangeMode: "open" }))}
              >
                From Open
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Controls whether index +/− is calculated from today's open or previous day's close.
            </p>
          </div>

          <Separator />

          {/* Shift Offsets */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Strike Gap</p>
              <p className="text-[11px] text-muted-foreground">
                Number of strikes to move per Shift Up / Down.
              </p>
            </div>
            <div className="space-y-1.5">
              {SHIFT_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  <div className="flex h-7 overflow-hidden rounded-md border border-border/50">
                    {[1, 2, 3, 4, 5].map((v) => {
                      const active = (draft[key] as number) === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => set(key, v)}
                          className={cn(
                            "w-8 text-xs font-medium transition-colors",
                            v > 1 && "border-l border-border/50",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          {v}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Auto Square-Off */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto Square-Off</p>
                <p className="text-[11px] text-muted-foreground">
                  Automatically exit all positions at the specified time.
                </p>
              </div>
              <Switch
                checked={draft.autoSquareOffEnabled}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, autoSquareOffEnabled: v }))}
              />
            </div>
            {draft.autoSquareOffEnabled && (
              <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                <Label className="text-xs text-muted-foreground shrink-0">Square-off time</Label>
                <Input
                  type="time"
                  value={draft.autoSquareOffTime}
                  onChange={(e) => setDraft((d) => ({ ...d, autoSquareOffTime: e.target.value }))}
                  className="h-7 w-28 text-xs"
                />
                <span className="text-[11px] text-muted-foreground">IST</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
