import { cn } from "@/lib/utils";
import type { CandleInterval } from "@/services/charts-api";

const TIMEFRAMES: { label: string; interval: CandleInterval }[] = [
  { label: "1m",  interval: "OneMinute" },
  { label: "30m", interval: "ThirtyMinute" },
  { label: "1D",  interval: "OneDay" },
  { label: "1W",  interval: "OneWeek" },
  { label: "1M",  interval: "OneMonth" },
];

interface TimeframeSwitcherProps {
  value: CandleInterval;
  onChange: (interval: CandleInterval) => void;
}

export function TimeframeSwitcher({ value, onChange }: TimeframeSwitcherProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-muted/30 p-0.5">
      {TIMEFRAMES.map(({ label, interval }) => (
        <button
          key={interval}
          onClick={() => onChange(interval)}
          className={cn(
            "cursor-pointer rounded px-2 py-1 text-xs font-medium transition-colors",
            value === interval
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
