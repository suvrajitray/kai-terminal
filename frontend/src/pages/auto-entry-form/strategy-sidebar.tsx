import { Activity, Calendar, Clock, Pencil, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { describeStrike, fmt12h } from "./utils";
import type { AutoEntryDraft } from "./types";

interface StrategySidebarProps {
  draft: AutoEntryDraft;
  lotSize: number;
}

export function StrategySidebar({ draft, lotSize }: StrategySidebarProps) {
  return (
    <div className="sticky top-20 space-y-4">
      <LivePreview draft={draft} />
      <StrategySummary draft={draft} lotSize={lotSize} />
      <StatusTip enabled={draft.enabled} />
      {draft.strikeMode === "Delta" && <DeltaTip />}
    </div>
  );
}

function LivePreview({ draft }: { draft: AutoEntryDraft }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base font-bold">Live Preview</span>
        <div className="flex items-center gap-1.5 ml-1">
          <div className="size-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">Updates as you edit</span>
        </div>
      </div>

      <div
        className={cn(
          "rounded-xl border p-4",
          draft.enabled ? "border-green-800/40 bg-green-950/30" : "border-border/40 bg-muted/10",
        )}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-900/60 text-indigo-300 border border-indigo-700/40">
            AUTO ENTRY
          </span>
          <span
            className={cn(
              "ml-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              draft.enabled ? "bg-green-700/40 text-green-300 border border-green-700/30" : "bg-muted/30 text-muted-foreground",
            )}
          >
            {draft.enabled ? "Active" : "Inactive"}
          </span>
        </div>
        <p className="text-xl font-bold leading-tight">
          <span className="text-muted-foreground font-medium text-base">SELL</span>{" "}
          <span>{draft.lots}</span>{" "}
          <span className="font-medium">lot{draft.lots !== 1 ? "s" : ""}</span>{" "}
          <span>{draft.instrument}</span>{" "}
          <span
            className={
              draft.optionType === "CE"
                ? "text-red-400"
                : draft.optionType === "PE"
                  ? "text-green-400"
                  : "text-indigo-400"
            }
          >
            {draft.optionType}
          </span>
        </p>
        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
          <PreviewRow icon={Activity} text={`Strike: ${describeStrike(draft.strikeMode, draft.strikeParam)}`} />
          <PreviewRow
            icon={Calendar}
            text={draft.onlyExpiryDay ? "Expiry day only" : draft.tradingDays.length === 5 ? "Mon – Fri" : draft.tradingDays.join(", ") || "—"}
          />
          <PreviewRow icon={Clock} text={`${fmt12h(draft.entryAfterTime)} – ${fmt12h(draft.noEntryAfterTime)}`} />
          {!draft.onlyExpiryDay && draft.excludeExpiryDay && <PreviewRow icon={Clock} text="Skip expiry days" />}
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ icon: Icon, text }: { icon: typeof Activity; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3 shrink-0 text-indigo-400" />
      <span>{text}</span>
    </div>
  );
}

function StrategySummary({ draft, lotSize }: StrategySidebarProps) {
  const rows = [
    { label: "Name", value: draft.name || "—", editPen: true },
    { label: "Instrument", value: draft.instrument },
    {
      label: "Option",
      value: draft.optionType,
      colored: draft.optionType === "PE" ? "green" : draft.optionType === "CE" ? "red" : "indigo",
    },
    { label: "Quantity", value: `${draft.lots} lot${draft.lots !== 1 ? "s" : ""} (${draft.lots * lotSize} units)` },
    { label: "Strike Method", value: draft.strikeMode + (draft.strikeMode !== "ATM" ? ` ${draft.strikeMode === "Delta" ? draft.strikeParam.toFixed(2) : draft.strikeParam}` : "") },
    { label: "Days", value: draft.onlyExpiryDay ? "Expiry only" : draft.tradingDays.join(", ") || "—" },
    { label: "Time Window", value: `${draft.entryAfterTime} – ${draft.noEntryAfterTime} IST` },
    { label: "Expiry", value: draft.expiryOffset === 0 ? "Nearest Expiry" : `Expiry +${draft.expiryOffset}` },
  ];

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm font-bold">Strategy Summary</span>
        <div className="flex-1 border-t border-border/40" />
      </div>
      <div className="space-y-2.5 text-sm">
        {rows.map(({ label, value, colored, editPen }) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <span className="shrink-0 text-muted-foreground text-xs">{label}</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={cn(
                  "text-right font-medium tabular-nums text-xs truncate",
                  colored === "green" && "text-green-400",
                  colored === "red" && "text-red-400",
                  colored === "indigo" && "text-indigo-400",
                )}
              >
                {value}
              </span>
              {editPen && <Pencil className="size-2.5 text-muted-foreground/40 shrink-0" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusTip({ enabled }: { enabled: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border p-3 text-xs",
        enabled ? "border-green-700/40 bg-green-950/40 text-green-300" : "border-border/40 bg-muted/10 text-muted-foreground",
      )}
    >
      <Zap className="size-3.5 shrink-0 mt-0.5 text-yellow-400" />
      <span>{enabled ? "Looks good! Your strategy is ready to automate." : "Strategy is disabled and will not run automatically."}</span>
    </div>
  );
}

function DeltaTip() {
  return (
    <div className="rounded-xl border border-indigo-800/40 bg-indigo-950/40 p-3 text-xs space-y-1">
      <p className="font-semibold text-foreground flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-indigo-800/50 text-indigo-300">💡</span>
        Pro Tip
      </p>
      <p className="text-muted-foreground">
        Delta between 0.15 – 0.35 works best for option selling strategies.
      </p>
    </div>
  );
}

