interface PositionCountBadgesProps {
  openCount: number;
  closedCount: number;
}

export function PositionCountBadges({ openCount, closedCount }: PositionCountBadgesProps) {
  return (
    <span className="flex items-center gap-1">
      {openCount > 0 && (
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          {openCount} open
        </span>
      )}
      {closedCount > 0 && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {closedCount} closed
        </span>
      )}
    </span>
  );
}
