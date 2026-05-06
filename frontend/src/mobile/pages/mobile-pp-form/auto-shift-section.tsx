import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AutoShiftSectionProps {
  broker: string;
  enabled: boolean;
  thresholdPct: string | number;
  maxCount: string | number;
  strikeGap: string | number;
  onEnabledChange: (v: boolean) => void;
  onThresholdPctChange: (v: string) => void;
  onMaxCountChange: (v: string) => void;
  onStrikeGapChange: (v: string) => void;
}

export function AutoShiftSection({
  broker, enabled, thresholdPct, maxCount, strikeGap,
  onEnabledChange, onThresholdPctChange, onMaxCountChange, onStrikeGapChange,
}: AutoShiftSectionProps) {
  return (
    <div className="px-4 space-y-3">
      <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Auto Shift</p>
          <p className="text-xs text-muted-foreground">Roll short options further OTM on breach</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      {enabled && (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${broker}-shift-threshold`} className="text-xs">Threshold (%)</Label>
            <Input
              id={`${broker}-shift-threshold`}
              type="number"
              min={1}
              value={thresholdPct}
              onChange={(e) => onThresholdPctChange(e.target.value)}
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${broker}-shift-max`} className="text-xs">Max Shifts</Label>
            <Input
              id={`${broker}-shift-max`}
              type="number"
              min={1}
              value={maxCount}
              onChange={(e) => onMaxCountChange(e.target.value)}
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${broker}-shift-gap`} className="text-xs">Strike Gap</Label>
            <Input
              id={`${broker}-shift-gap`}
              type="number"
              min={1}
              value={strikeGap}
              onChange={(e) => onStrikeGapChange(e.target.value)}
              className="tabular-nums"
            />
          </div>
        </div>
      )}
    </div>
  );
}
