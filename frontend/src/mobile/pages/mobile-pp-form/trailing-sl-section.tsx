import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TrailingSlSectionProps {
  broker: string;
  enabled: boolean;
  activateAt: string | number;
  lockProfitAt: string | number;
  increaseBy: string | number;
  trailBy: string | number;
  activateAtWarning: boolean;
  lockProfitWarning: boolean;
  onEnabledChange: (v: boolean) => void;
  onActivateAtChange: (v: string) => void;
  onLockProfitAtChange: (v: string) => void;
  onIncreaseByChange: (v: string) => void;
  onTrailByChange: (v: string) => void;
}

export function TrailingSlSection({
  broker, enabled, activateAt, lockProfitAt, increaseBy, trailBy,
  activateAtWarning, lockProfitWarning,
  onEnabledChange, onActivateAtChange, onLockProfitAtChange, onIncreaseByChange, onTrailByChange,
}: TrailingSlSectionProps) {
  return (
    <div className="px-4 space-y-3">
      <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-4 py-3">
        <div>
          <p className="text-sm font-medium">MTM Trailing</p>
          <p className="text-xs text-muted-foreground">Raise stop loss as profit grows</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      {enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${broker}-activate-at`} className="text-xs">Activate At (₹)</Label>
              <Input
                id={`${broker}-activate-at`}
                type="number"
                value={activateAt}
                onChange={(e) => onActivateAtChange(e.target.value)}
                className="tabular-nums"
              />
              {activateAtWarning && <p className="text-[11px] text-destructive">Must be below target</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${broker}-lock-at`} className="text-xs">Lock At (₹)</Label>
              <Input
                id={`${broker}-lock-at`}
                type="number"
                value={lockProfitAt}
                onChange={(e) => onLockProfitAtChange(e.target.value)}
                className="tabular-nums"
              />
              {lockProfitWarning && <p className="text-[11px] text-destructive">Must be below target</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${broker}-increase-by`} className="text-xs">Increase By (₹)</Label>
              <Input
                id={`${broker}-increase-by`}
                type="number"
                value={increaseBy}
                onChange={(e) => onIncreaseByChange(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${broker}-trail-by`} className="text-xs">Trail By (₹)</Label>
              <Input
                id={`${broker}-trail-by`}
                type="number"
                value={trailBy}
                onChange={(e) => onTrailByChange(e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
