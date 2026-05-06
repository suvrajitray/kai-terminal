import { cn } from "@/lib/utils";
import { BrokerBadge } from "@/components/ui/broker-badge";

interface OrdersBrokerFilterProps {
  brokerIds: string[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export function OrdersBrokerFilter({ brokerIds, selected, onSelect }: OrdersBrokerFilterProps) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border/40 bg-muted/20 px-3">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
          selected === null
            ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        All
      </button>
      {brokerIds.map((bId) => (
        <button
          key={bId}
          onClick={() => onSelect(selected === bId ? null : bId)}
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
            selected === bId
              ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <BrokerBadge brokerId={bId} size={12} />
          <span className="capitalize">{bId}</span>
        </button>
      ))}
    </div>
  );
}
