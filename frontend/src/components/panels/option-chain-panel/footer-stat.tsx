import { cn } from "@/lib/utils";

export function Sep() {
  return <span className="text-muted-foreground/20 select-none">|</span>;
}

export function FooterStat({
  label,
  value,
  valueClass,
  title,
}: {
  label: string;
  value: string;
  valueClass?: string;
  title?: string;
}) {
  return (
    <span className="flex items-center gap-1" title={title}>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50">{label}</span>
      <span className={cn("font-mono text-[11px] font-semibold tabular-nums text-foreground", valueClass)}>
        {value}
      </span>
    </span>
  );
}

