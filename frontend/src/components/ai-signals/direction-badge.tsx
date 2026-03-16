import { cn } from "@/lib/utils";

interface DirectionBadgeProps {
  direction: string | null;
}

const DIRECTION_STYLES: Record<string, string> = {
  "Strong Bullish": "bg-green-600 text-white",
  "Bullish":        "bg-green-500 text-white",
  "Sideways":       "bg-amber-500 text-white",
  "Bearish":        "bg-red-500 text-white",
  "Strong Bearish": "bg-red-700 text-white",
};

export function DirectionBadge({ direction }: DirectionBadgeProps) {
  if (!direction) return null;

  const style = DIRECTION_STYLES[direction] ?? "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide uppercase",
        style,
      )}
    >
      {direction}
    </span>
  );
}
