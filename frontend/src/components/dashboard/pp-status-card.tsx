import { Link } from "react-router-dom";
import { ShieldCheck, ShieldOff, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";

const INR = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0 });

export function PpStatusCard() {
  const { enabled, mtmTarget, mtmSl, trailingEnabled } = useProfitProtectionStore();

  return (
    <Card className="border-border/40 bg-muted/10">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Profit Protection
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Status pill */}
        <div className="flex items-center gap-2">
          {enabled ? (
            <ShieldCheck className="size-4 text-green-500" />
          ) : (
            <ShieldOff className="size-4 text-muted-foreground/50" />
          )}
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              enabled
                ? "bg-green-500/15 text-green-500"
                : "bg-muted/40 text-muted-foreground",
            )}
          >
            {enabled ? "Active" : "Disabled"}
          </span>
        </div>

        {/* Config rows */}
        <div className="space-y-2 rounded-md border border-border/30 bg-muted/20 px-3 py-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Target</span>
            <span className="tabular-nums font-medium text-green-500">
              ₹{INR.format(mtmTarget)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Stop Loss</span>
            <span className="tabular-nums font-medium text-red-500">
              ₹{INR.format(mtmSl)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Trailing</span>
            <span className={cn("font-medium", trailingEnabled ? "text-foreground" : "text-muted-foreground/50")}>
              {trailingEnabled ? "On" : "Off"}
            </span>
          </div>
        </div>

        {/* Configure link */}
        <Link
          to="/terminal"
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Configure in Terminal
          <ExternalLink className="size-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
