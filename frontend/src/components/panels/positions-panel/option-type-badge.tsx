import { cn } from "@/lib/utils";

interface OptionTypeBadgeProps {
  type: "CE" | "PE";
}

export function OptionTypeBadge({ type }: OptionTypeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold",
        type === "CE"
          ? "bg-green-500/15 text-green-500"
          : "bg-red-500/15 text-red-500",
      )}
    >
      {type}
    </span>
  );
}
