import { useRef, useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { DraftFieldSetter, AutoEntryDraft } from "./types";

interface BrokerOption {
  id: string;
  name: string;
}

interface PageHeaderProps {
  draft: AutoEntryDraft;
  isNew: boolean;
  brokers: BrokerOption[];
  onBack: () => void;
  onFieldChange: DraftFieldSetter;
}

export function PageHeader({ draft, isNew, brokers, onBack, onFieldChange }: PageHeaderProps) {
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const startEditingName = () => {
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  return (
    <div className="mb-8">
      <div className="flex items-start justify-between mb-5">
        <div>
          <button
            onClick={onBack}
            className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Auto Entry
          </button>
          <h1 className="text-3xl font-bold tracking-tight">{isNew ? "Create Strategy" : "Edit Strategy"}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Build and automate your trades with precision.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-3 ml-6 mt-1">
          <div
            className={cn(
              "flex items-center gap-2 rounded-full border px-3.5 py-1 cursor-pointer select-none transition-all",
              draft.enabled ? "border-green-500/30 bg-green-500/10" : "border-border/40 bg-muted/10",
            )}
            onClick={() => onFieldChange("enabled", !draft.enabled)}
          >
            <span className={cn("text-sm font-semibold", draft.enabled ? "text-green-400" : "text-muted-foreground")}>
              {draft.enabled ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(value) => onFieldChange("enabled", value)}
              onClick={(event) => event.stopPropagation()}
              className="data-[state=checked]:bg-green-500 scale-90"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-card overflow-hidden flex items-stretch">
        <div className="flex-1 px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground/50 mb-2">Strategy Name</p>
          {editingName ? (
            <input
              ref={nameInputRef}
              value={draft.name}
              onChange={(event) => onFieldChange("name", event.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(event) => event.key === "Enter" && setEditingName(false)}
              placeholder="Unnamed Strategy"
              className="bg-transparent border-0 outline-none text-xl font-semibold text-foreground placeholder:text-muted-foreground/30 w-full"
            />
          ) : (
            <button
              type="button"
              onClick={startEditingName}
              className="flex items-center gap-2 group/name cursor-pointer"
            >
              <span className="text-xl font-semibold text-foreground">
                {draft.name || <span className="text-muted-foreground/30">Unnamed Strategy</span>}
              </span>
              <Pencil className="size-3.5 text-muted-foreground/40 group-hover/name:text-muted-foreground/70 transition-colors" />
            </button>
          )}
        </div>

        {brokers.length > 0 && (
          <>
            <div className="w-px bg-border/40 my-3" />
            <div className="px-5 py-4 flex flex-col justify-center w-[300px] shrink-0">
              <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground/50 mb-2">Broker</p>
              <Select value={draft.brokerType} onValueChange={(value) => onFieldChange("brokerType", value)}>
                <SelectTrigger className="h-auto border-0 bg-transparent dark:bg-transparent dark:hover:bg-transparent p-0 shadow-none ring-0 outline-none text-sm font-semibold gap-1.5 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 cursor-pointer [&>svg]:text-muted-foreground/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {brokers.map((broker) => (
                    <SelectItem key={broker.id} value={broker.id}>{broker.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

