import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiSentimentResponse } from "@/services/ai-signals-api";

interface MarketContextBarProps {
  data: AiSentimentResponse;
}

function formatNum(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function PriceChip({
  label,
  ltp,
  isPositive,
}: {
  label: string;
  ltp: number;
  isPositive?: boolean;
}) {
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-sm">{formatNum(ltp)}</span>
      {isPositive !== undefined && (
        <Icon
          className={cn("size-3.5", isPositive ? "text-green-500" : "text-red-500")}
        />
      )}
    </div>
  );
}

export function MarketContextBar({ data }: MarketContextBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border/40 bg-muted/20 px-4 py-2.5">
      <PriceChip label="NIFTY"     ltp={data.niftyLtp}     />
      <div className="h-4 w-px bg-border/40" />
      <PriceChip label="BANKNIFTY" ltp={data.bankNiftyLtp} />
      <div className="h-4 w-px bg-border/40" />
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">PCR</span>
        <span
          className={cn(
            "font-semibold tabular-nums text-sm",
            data.niftyPcr >= 1 ? "text-green-500" : "text-red-500",
          )}
        >
          {data.niftyPcr.toFixed(2)}
        </span>
      </div>
      <div className="ml-auto text-xs text-muted-foreground">
        Snapshot as of{" "}
        {new Date(data.generatedAt).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
    </div>
  );
}
