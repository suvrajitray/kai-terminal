import { Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { STRIKE_MODES } from "./constants";
import { StepSection } from "./step-section";
import { strikeParamLabel } from "./utils";
import type { DraftFieldSetter, AutoEntryDraft } from "./types";

interface StrikeSelectionSectionProps {
  draft: AutoEntryDraft;
  onFieldChange: DraftFieldSetter;
}

export function StrikeSelectionSection({ draft, onFieldChange }: StrikeSelectionSectionProps) {
  const adjustOtmParam = (delta: number) => {
    onFieldChange("strikeParam", Math.max(0, Math.round(draft.strikeParam) + delta));
  };

  return (
    <StepSection num={3} title="How to Select Strike" subtitle="Choose strike selection method">
      <div className="grid grid-cols-4 gap-3">
        {STRIKE_MODES.map(({ id: mode, label, sub, Icon }) => {
          const active = draft.strikeMode === mode;
          const showParam = active && mode !== "ATM";

          return (
            <button
              key={mode}
              onClick={() => {
                onFieldChange("strikeMode", mode);
                if (mode === "ATM") onFieldChange("strikeParam", 0);
                else if (mode === "Delta" && draft.strikeParam === 0) onFieldChange("strikeParam", 0.25);
              }}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                active ? "border-indigo-500/50 bg-indigo-900/30" : "border-border/40 bg-muted/10 hover:border-border/70",
              )}
            >
              <div className={cn("flex items-center justify-between gap-2", showParam && "mb-3")}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg shrink-0",
                      active ? "bg-indigo-500/20 text-indigo-400" : "bg-muted/20 text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={cn("text-sm font-bold leading-tight", active ? "text-foreground" : "text-muted-foreground")}>
                      {label}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight">{sub}</p>
                  </div>
                </div>
                <div
                  className={cn(
                    "size-3.5 rounded-full border-2 shrink-0",
                    active ? "border-green-400 bg-green-400 shadow shadow-green-400/40" : "border-muted-foreground/30",
                  )}
                />
              </div>

              {showParam && (
                <div className="mt-4 pt-3 border-t border-indigo-500/20" onClick={(event) => event.stopPropagation()}>
                  <p className="text-[10px] text-muted-foreground mb-2">{strikeParamLabel(mode)}</p>

                  {mode === "OTM" ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          adjustOtmParam(-1);
                        }}
                        className="flex size-6 items-center justify-center rounded border border-border/50 bg-background/80 text-muted-foreground hover:text-foreground"
                      >
                        <Minus className="size-2.5" />
                      </button>
                      <span className="flex-1 text-center tabular-nums text-sm font-bold">
                        {Math.round(draft.strikeParam)}
                      </span>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          adjustOtmParam(1);
                        }}
                        className="flex size-6 items-center justify-center rounded border border-border/50 bg-background/80 text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="size-2.5" />
                      </button>
                    </div>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      step={mode === "Delta" ? 0.01 : 1}
                      value={mode === "Delta" ? draft.strikeParam : Math.round(draft.strikeParam)}
                      onChange={(event) => {
                        const value = parseFloat(event.target.value);
                        if (!Number.isNaN(value)) onFieldChange("strikeParam", Math.max(0, value));
                      }}
                      onClick={(event) => event.stopPropagation()}
                      className="h-8 border-border/50 bg-background/80 text-sm font-semibold tabular-nums"
                    />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </StepSection>
  );
}

