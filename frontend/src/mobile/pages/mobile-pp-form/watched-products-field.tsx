import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type WatchedProducts = "All" | "Intraday" | "Delivery";

interface WatchedProductsFieldProps {
  value: WatchedProducts;
  onChange: (value: WatchedProducts) => void;
}

export function WatchedProductsField({ value, onChange }: WatchedProductsFieldProps) {
  return (
    <div className="px-4 space-y-2">
      <Label className="text-xs text-muted-foreground">Watch positions</Label>
      <div className="flex gap-2">
        {(["All", "Intraday", "Delivery"] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              "flex-1 rounded-md border px-2 py-2 text-xs font-medium transition-all",
              value === opt
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border/40 bg-muted/20 text-muted-foreground",
            )}
          >
            {opt === "All" ? "All" : opt === "Intraday" ? "MIS" : "NRML"}
          </button>
        ))}
      </div>
    </div>
  );
}
