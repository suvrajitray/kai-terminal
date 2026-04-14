import React from "react";
import { ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UNDERLYING_KEYS } from "@/lib/shift-config";

const UNDERLYINGS = Object.keys(UNDERLYING_KEYS);

function formatExpiry(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();
  const month = date.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
  const suffix = d === 1 || d === 21 || d === 31 ? "st" : d === 2 || d === 22 ? "nd" : d === 3 || d === 23 ? "rd" : "th";
  return `${day}, ${d}${suffix} ${month} ${y}`;
}

interface SharedControlsProps {
  broker: "upstox" | "zerodha";
  bothConnected: boolean;
  underlying: string;
  expiry: string;
  expiries: string[];
  product: "I" | "D";
  onBrokerChange: (b: "upstox" | "zerodha") => void;
  onUnderlyingChange: (u: string) => void;
  onExpiryChange: (e: string) => void;
  onProductChange: (p: "I" | "D") => void;
}

export const SharedControls = React.memo(function SharedControls({
  broker,
  bothConnected,
  underlying,
  expiry,
  expiries,
  product,
  onBrokerChange,
  onUnderlyingChange,
  onExpiryChange,
  onProductChange,
}: SharedControlsProps) {
  return (
    <div className="space-y-4">
      {/* Broker selector — only shown when both brokers are connected */}
      {bothConnected && (
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowRightLeft className="size-3.5" />
            <span>Route via</span>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border/40 bg-background p-0.5">
            {(["upstox", "zerodha"] as const).map((b) => (
              <button
                key={b}
                onClick={() => onBrokerChange(b)}
                className={cn(
                  "cursor-pointer rounded px-3 py-1 text-xs font-semibold transition-all capitalize",
                  broker === b
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {b === "upstox" ? "Upstox" : "Zerodha"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Underlying */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Underlying</p>
        <div className="flex flex-wrap gap-1.5">
          {UNDERLYINGS.map((u) => (
            <button
              key={u}
              onClick={() => onUnderlyingChange(u)}
              className={cn(
                "rounded px-3 py-1 text-xs font-semibold transition-colors border",
                underlying === u
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Expiry + Product */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Expiry</p>
          <Select value={expiry} onValueChange={onExpiryChange} disabled={expiries.length === 0}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={expiries.length === 0 ? "No contracts" : "Select expiry"}>
                {expiry ? formatExpiry(expiry) : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {expiries.map((e) => (
                <SelectItem key={e} value={e}>{formatExpiry(e)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Product</p>
          <div className="flex h-9 items-center gap-4">
            {(["I", "D"] as const).map((p) => (
              <button key={p} onClick={() => onProductChange(p)} className="flex items-center gap-2 group">
                <span className={cn(
                  "size-4 rounded-full border-2 flex items-center justify-center transition-colors",
                  product === p ? "border-primary" : "border-muted-foreground/30 group-hover:border-muted-foreground/50",
                )}>
                  {product === p && <span className="size-2 rounded-full bg-primary" />}
                </span>
                <span className={cn("text-sm font-medium transition-colors", product === p ? "text-foreground" : "text-muted-foreground")}>
                  {p === "I" ? "Intraday" : "Delivery"}
                </span>
                <span className="text-[11px] text-muted-foreground/50">{p === "I" ? "MIS" : "NRML"}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
