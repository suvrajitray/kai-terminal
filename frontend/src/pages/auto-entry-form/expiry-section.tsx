import { Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StepSection } from "./step-section";
import type { DraftFieldSetter, AutoEntryDraft } from "./types";

interface ExpirySectionProps {
  draft: AutoEntryDraft;
  onFieldChange: DraftFieldSetter;
}

export function ExpirySection({ draft, onFieldChange }: ExpirySectionProps) {
  return (
    <StepSection num={4} title="Expiry Selection" subtitle="Pick which expiry to use" last>
      <div className="flex items-center gap-6">
        <div className="space-y-2 w-64">
          <p className="text-xs font-medium text-foreground/70">Expiry Selection</p>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-indigo-400 z-10" />
            <Select
              value={String(draft.expiryOffset)}
              onValueChange={(value) => onFieldChange("expiryOffset", parseInt(value, 10))}
            >
              <SelectTrigger className="border-border/50 pl-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Nearest Expiry (0)</SelectItem>
                <SelectItem value="1">Next Expiry (+1)</SelectItem>
                <SelectItem value="2">Next-Next Expiry (+2)</SelectItem>
                <SelectItem value="3">Expiry +3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-5">0 = Nearest weekly or monthly expiry</p>
      </div>
    </StepSection>
  );
}

