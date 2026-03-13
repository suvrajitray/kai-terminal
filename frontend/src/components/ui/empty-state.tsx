import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  className?: string;
}

export function EmptyState({ icon: Icon, message, className }: EmptyStateProps) {
  return (
    <div className={cn("flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/40", className)}>
      <Icon className="size-8 stroke-[1.25]" />
      <p className="text-xs">{message}</p>
    </div>
  );
}
