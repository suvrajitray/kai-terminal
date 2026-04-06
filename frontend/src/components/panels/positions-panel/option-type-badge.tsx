import { cn } from "@/lib/utils";

interface OptionTypeBadgeProps {
  type: "CE" | "PE";
}

export function OptionTypeBadge({ type }: OptionTypeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold",
        type === "PE"
          ? "bg-emerald-500/15 text-emerald-500"
          : "bg-rose-500/15 text-rose-500",
      )}
    >
      {type}
    </span>
  );
}
