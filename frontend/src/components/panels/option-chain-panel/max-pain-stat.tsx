import { cn } from "@/lib/utils";

interface MaxPainStatProps {
  maxPain: number;
  spotPrice: number;
}

export function MaxPainStat({ maxPain, spotPrice }: MaxPainStatProps) {
  const distance = spotPrice > 0 ? Math.round(maxPain - spotPrice) : null;
  const absDistance = distance !== null ? Math.abs(distance) : null;
  const arrow = distance === null ? "" : distance > 0 ? "↑" : "↓";
  const saferSide = distance === null ? null : distance > 0 ? "CE safe" : "PE safe";

  return (
    <span
      className="flex items-center gap-1.5"
      title={`Max Pain ₹${maxPain}. ${saferSide ?? ""}. Market gravitates here by expiry.`}
    >
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Pain</span>
      <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">{maxPain}</span>
      {absDistance !== null && absDistance > 0 && (
        <span className={cn("font-mono text-[10px]", distance! > 0 ? "text-emerald-400/70" : "text-rose-400/70")}>
          {arrow}{absDistance} pts
        </span>
      )}
    </span>
  );
}

