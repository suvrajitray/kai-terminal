import { Activity, Minus, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { INSTRUMENTS } from "@/lib/lot-sizes";
import { OPTION_TYPES } from "./constants";
import { StepSection } from "./step-section";
import type { DraftFieldSetter, AutoEntryDraft } from "./types";

interface TradeSettingsSectionProps {
  draft: AutoEntryDraft;
  lotSize: number;
  onFieldChange: DraftFieldSetter;
}

export function TradeSettingsSection({ draft, lotSize, onFieldChange }: TradeSettingsSectionProps) {
  return (
    <StepSection num={1} title="What to Trade" subtitle="Choose instrument, option type and quantity">
      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground/70">Instrument</p>
          <div className="relative">
            <Activity className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-indigo-400" />
            <Select value={draft.instrument} onValueChange={(value) => onFieldChange("instrument", value)}>
              <SelectTrigger className="w-full border-border/50 bg-background pl-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSTRUMENTS.map((instrument) => (
                  <SelectItem key={instrument} value={instrument}>{instrument}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground">Index · NSE</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground/70">Option Type</p>
          <div className="flex gap-1">
            {OPTION_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => onFieldChange("optionType", type.id)}
                className={cn(
                  "flex-1 rounded-md border px-2 py-2 text-sm font-semibold transition-all",
                  draft.optionType === type.id
                    ? type.id === "CE"
                      ? "border-red-500/50 bg-red-500/15 text-red-300"
                      : type.id === "PE"
                        ? "border-green-500/50 bg-green-500/20 text-green-300"
                        : "border-indigo-500/50 bg-indigo-500/15 text-indigo-300"
                    : "border-border/50 bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {type.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Choose which option to sell</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground/70">Quantity (Lots)</p>
          <div className="flex items-center rounded-md border border-border/50 bg-background">
            <button
              onClick={() => onFieldChange("lots", Math.max(1, draft.lots - 1))}
              className="flex size-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="flex-1 text-center tabular-nums font-semibold text-sm">{draft.lots}</span>
            <button
              onClick={() => onFieldChange("lots", draft.lots + 1)}
              className="flex size-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {draft.lots} lot = {draft.lots * lotSize} units
          </p>
        </div>
      </div>
    </StepSection>
  );
}

