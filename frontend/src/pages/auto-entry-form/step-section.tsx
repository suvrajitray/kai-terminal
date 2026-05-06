import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StepSectionProps {
  num: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  last?: boolean;
}

export function StepSection({ num, title, subtitle, children, last = false }: StepSectionProps) {
  return (
    <div className="flex gap-5 mb-1">
      <div className="flex flex-col items-center shrink-0">
        <div className="flex size-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/25">
          {num}
        </div>
        {!last && <div className="mt-2 w-px flex-1 bg-border/30 min-h-8" />}
      </div>

      <div className={cn("flex-1 min-w-0", !last && "pb-8")}>
        <h3 className="text-base font-semibold leading-none mt-1.5">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-4 rounded-xl border border-border/50 bg-card p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

