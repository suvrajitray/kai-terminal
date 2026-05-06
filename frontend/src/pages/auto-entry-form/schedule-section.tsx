import { Calendar, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { TRADING_DAYS } from "./constants";
import { StepSection } from "./step-section";
import type { DraftFieldSetter, AutoEntryDraft } from "./types";

interface ScheduleSectionProps {
  draft: AutoEntryDraft;
  onFieldChange: DraftFieldSetter;
}

export function ScheduleSection({ draft, onFieldChange }: ScheduleSectionProps) {
  const toggleDay = (day: string) => {
    const days = draft.tradingDays.includes(day)
      ? draft.tradingDays.filter((currentDay) => currentDay !== day)
      : [...draft.tradingDays, day];
    onFieldChange("tradingDays", days);
  };

  return (
    <StepSection num={2} title="When to Trade" subtitle="Set schedule & trading days">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground/70">Trading Days</p>
            <div className={cn("flex gap-1.5 flex-wrap", draft.onlyExpiryDay && "opacity-40 pointer-events-none")}>
              {TRADING_DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm font-medium transition-all",
                    draft.tradingDays.includes(day)
                      ? "border-green-600/50 bg-green-900/40 text-green-300"
                      : "border-border/50 bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {day}
                </button>
              ))}
              <button disabled className="rounded-md border border-border/30 bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground/40 cursor-not-allowed">
                Sat
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {draft.onlyExpiryDay ? "Overridden by \"Only on expiry day\"" : "Select days when the strategy can run"}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground/70">Entry Window</p>
            <div className="flex items-center rounded-md border border-border/50 bg-background px-3 py-2 focus-within:border-indigo-500/40 transition-colors">
              <Clock className="size-3.5 shrink-0 text-indigo-400 mr-2" />
              <input
                type="time"
                value={draft.entryAfterTime}
                onChange={(event) => onFieldChange("entryAfterTime", event.target.value)}
                className="bg-transparent border-0 outline-none tabular-nums text-sm font-medium text-foreground w-[5.5rem] [&::-webkit-calendar-picker-indicator]:hidden"
              />
              <span className="flex-1 text-center text-muted-foreground text-xs">→</span>
              <div className="ml-auto flex items-center">
                <Clock className="size-3.5 shrink-0 text-indigo-400 mr-2" />
                <input
                  type="time"
                  value={draft.noEntryAfterTime}
                  onChange={(event) => onFieldChange("noEntryAfterTime", event.target.value)}
                  className="bg-transparent border-0 outline-none tabular-nums text-sm font-medium text-foreground w-[5.5rem] text-right [&::-webkit-calendar-picker-indicator]:hidden"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">IST · New positions will only be opened within this time range</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ExpiryToggle
            id="only-expiry"
            checked={draft.onlyExpiryDay}
            activeClassName="border-indigo-500/30 bg-indigo-500/5"
            title="Only on expiry day"
            description="Run only when the day is expiry"
            onChange={(value) => {
              onFieldChange("onlyExpiryDay", value);
              if (value) onFieldChange("excludeExpiryDay", false);
            }}
          />

          <ExpiryToggle
            id="skip-expiry"
            checked={draft.excludeExpiryDay}
            disabled={draft.onlyExpiryDay}
            activeClassName="border-green-600/30 bg-green-900/10"
            title="Skip expiry day"
            description={draft.excludeExpiryDay && !draft.onlyExpiryDay ? "Recommended for safer automation" : "Do not trade on expiry date"}
            warning={draft.excludeExpiryDay && !draft.onlyExpiryDay}
            onChange={(value) => onFieldChange("excludeExpiryDay", value)}
          />
        </div>
      </div>
    </StepSection>
  );
}

function ExpiryToggle({
  id,
  checked,
  disabled = false,
  activeClassName,
  title,
  description,
  warning = false,
  onChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  activeClassName: string;
  title: string;
  description: string;
  warning?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 transition-all",
        checked && !disabled ? activeClassName : "border-border/40 bg-muted/10",
        disabled && "opacity-40 pointer-events-none",
      )}
    >
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className={cn("mt-0.5 shrink-0", id === "skip-expiry" && checked && "data-[state=checked]:bg-green-500")}
      />
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium block">
          {title}
        </label>
        <p className={cn("text-[11px] mt-0.5", warning ? "text-amber-500/90" : "text-muted-foreground")}>
          {warning ? `⚠ ${description}` : description}
        </p>
      </div>
      <Calendar className="size-4 shrink-0 text-muted-foreground/40 mt-0.5" />
    </div>
  );
}

