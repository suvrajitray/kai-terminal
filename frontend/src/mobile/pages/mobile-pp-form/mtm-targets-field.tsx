import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MtmTargetsFieldProps {
  broker: string;
  mtmTarget: string | number;
  mtmSl: string | number;
  targetWarning: boolean;
  slWarning: boolean;
  onTargetChange: (v: string) => void;
  onSlChange: (v: string) => void;
}

export function MtmTargetsField({
  broker, mtmTarget, mtmSl, targetWarning, slWarning, onTargetChange, onSlChange,
}: MtmTargetsFieldProps) {
  return (
    <div className="px-4 grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${broker}-mtm-target`} className="text-xs">MTM Target (₹)</Label>
        <Input
          id={`${broker}-mtm-target`}
          type="number"
          value={mtmTarget}
          onChange={(e) => onTargetChange(e.target.value)}
          className="tabular-nums"
        />
        {targetWarning && <p className="text-[11px] text-destructive">Below current MTM</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${broker}-mtm-sl`} className="text-xs">MTM Stop (₹)</Label>
        <Input
          id={`${broker}-mtm-sl`}
          type="text"
          inputMode="numeric"
          value={mtmSl}
          onChange={(e) => onSlChange(e.target.value)}
          className="tabular-nums"
        />
        {slWarning && <p className="text-[11px] text-destructive">Above current MTM</p>}
      </div>
    </div>
  );
}
