import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getUserBrokers, getUserRiskConfig, type UserRiskConfig } from "@/services/admin-api";

function ConfigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium tabular-nums">{children}</span>
    </div>
  );
}

export function RiskConfigDialog({
  user,
  open,
  onClose,
}: {
  user: { email: string; name: string };
  open: boolean;
  onClose: () => void;
}) {
  const [brokers, setBrokers] = useState<string[]>([]);
  const [broker, setBroker] = useState<"upstox" | "zerodha">("upstox");
  const [config, setConfig] = useState<UserRiskConfig | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    getUserBrokers(user.email).then((list) => {
      setBrokers(list);
      if (list.length > 0) setBroker(list[0] as "upstox" | "zerodha");
    });
  }, [open, user.email]);

  useEffect(() => {
    if (!open || !broker) return;
    setLoading(true);
    setConfig(undefined);
    getUserRiskConfig(user.email, broker)
      .then(setConfig)
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, [open, user.email, broker]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Risk Config — {user.name}</DialogTitle>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </DialogHeader>

        {brokers.length > 1 && (
          <div className="flex gap-1 mt-1">
            {brokers.map((b) => (
              <button
                key={b}
                onClick={() => setBroker(b as "upstox" | "zerodha")}
                className={`px-3 py-1 rounded text-xs capitalize transition-colors ${
                  broker === b
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        )}

        <div className="mt-2">
          {loading ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
          ) : config === null ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No risk config saved for {broker}.
            </p>
          ) : config ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">General</p>
                <ConfigField label="PP Enabled">
                  <Badge variant={config.enabled ? "default" : "secondary"} className="text-xs py-0">
                    {config.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </ConfigField>
                <ConfigField label="Watched Products">{config.watchedProducts}</ConfigField>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">P&amp;L Limits</p>
                <ConfigField label="MTM Target">₹{config.mtmTarget.toLocaleString("en-IN")}</ConfigField>
                <ConfigField label="MTM Stop Loss">₹{Math.abs(config.mtmSl).toLocaleString("en-IN")}</ConfigField>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Trailing Stop Loss</p>
                <ConfigField label="Enabled">
                  <Badge variant={config.trailingEnabled ? "default" : "secondary"} className="text-xs py-0">
                    {config.trailingEnabled ? "On" : "Off"}
                  </Badge>
                </ConfigField>
                <ConfigField label="Activate At">₹{config.trailingActivateAt.toLocaleString("en-IN")}</ConfigField>
                <ConfigField label="Lock Profit At">₹{config.lockProfitAt.toLocaleString("en-IN")}</ConfigField>
                <ConfigField label="Raise By">₹{config.trailBy.toLocaleString("en-IN")} every ₹{config.increaseBy.toLocaleString("en-IN")}</ConfigField>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Auto Shift</p>
                <ConfigField label="Enabled">
                  <Badge variant={config.autoShiftEnabled ? "default" : "secondary"} className="text-xs py-0">
                    {config.autoShiftEnabled ? "On" : "Off"}
                  </Badge>
                </ConfigField>
                <ConfigField label="Threshold">{config.autoShiftThresholdPct}%</ConfigField>
                <ConfigField label="Max Shifts">{config.autoShiftMaxCount}</ConfigField>
                <ConfigField label="Strike Gap">{config.autoShiftStrikeGap}</ConfigField>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
