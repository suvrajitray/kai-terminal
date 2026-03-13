import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useUserTradingSettingsStore, type IndexChangeMode } from "@/stores/user-trading-settings-store";
import { saveUserTradingSettings, type UserTradingSettings } from "@/services/user-settings-api";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHIFT_FIELDS: { key: keyof UserTradingSettings; label: string }[] = [
  { key: "niftyShiftOffset", label: "NIFTY" },
  { key: "bankniftyShiftOffset", label: "BANKNIFTY" },
  { key: "midcpniftyShiftOffset", label: "MIDCPNIFTY" },
  { key: "finniftyShiftOffset", label: "FINNIFTY" },
  { key: "sensexShiftOffset", label: "SENSEX" },
  { key: "bankexShiftOffset", label: "BANKEX" },
];

export function UserTradingSettingsDialog({ open, onClose }: Props) {
  const store = useUserTradingSettingsStore();
  const [draft, setDraft] = useState<UserTradingSettings>(() => ({
    defaultStoplossPercentage: store.defaultStoplossPercentage,
    niftyShiftOffset: store.niftyShiftOffset,
    bankniftyShiftOffset: store.bankniftyShiftOffset,
    midcpniftyShiftOffset: store.midcpniftyShiftOffset,
    finniftyShiftOffset: store.finniftyShiftOffset,
    sensexShiftOffset: store.sensexShiftOffset,
    bankexShiftOffset: store.bankexShiftOffset,
  }));
  const [indexChangeMode, setIndexChangeMode] = useState<IndexChangeMode>(store.indexChangeMode);
  const [saving, setSaving] = useState(false);

  // Sync draft from store each time dialog opens
  useEffect(() => {
    if (!open) return;
    setDraft({
      defaultStoplossPercentage: store.defaultStoplossPercentage,
      niftyShiftOffset: store.niftyShiftOffset,
      bankniftyShiftOffset: store.bankniftyShiftOffset,
      midcpniftyShiftOffset: store.midcpniftyShiftOffset,
      finniftyShiftOffset: store.finniftyShiftOffset,
      sensexShiftOffset: store.sensexShiftOffset,
      bankexShiftOffset: store.bankexShiftOffset,
    });
    setIndexChangeMode(store.indexChangeMode);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: keyof UserTradingSettings, value: number) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveUserTradingSettings(draft);
      store.setSettings(draft);
      store.setIndexChangeMode(indexChangeMode);
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
          {/* Default Stoploss */}
          <div className="space-y-1.5">
            <Label htmlFor="sl-pct">Default Stoploss Percentage (%)</Label>
            <Input
              id="sl-pct"
              type="number"
              min={0}
              max={100}
              value={draft.defaultStoplossPercentage}
              onChange={(e) => set("defaultStoplossPercentage", Number(e.target.value))}
            />
            <p className="text-[11px] text-muted-foreground">
              Applied as the default stop loss when placing option orders.
            </p>
          </div>

          <Separator />

          {/* Index Change Mode */}
          <div className="space-y-1.5">
            <Label>Index Change Display</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={indexChangeMode === "open" ? "default" : "outline"}
                onClick={() => setIndexChangeMode("open")}
              >
                From Open
              </Button>
              <Button
                type="button"
                size="sm"
                variant={indexChangeMode === "prevClose" ? "default" : "outline"}
                onClick={() => setIndexChangeMode("prevClose")}
              >
                From Prev Close
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
              <p className="text-sm font-medium">Shift Offsets</p>
              <p className="text-[11px] text-muted-foreground">
                Premium offset (₹) used for Shift Up / Shift Down per index.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {SHIFT_FIELDS.map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type="number"
                    min={0}
                    value={draft[key] as number}
                    onChange={(e) => set(key, Number(e.target.value))}
                  />
                </div>
              ))}
            </div>
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
