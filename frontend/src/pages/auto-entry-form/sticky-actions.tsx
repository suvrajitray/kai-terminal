import { RotateCcw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StickyActionsProps {
  saving: boolean;
  onCancel: () => void;
  onReset: () => void;
  onSave: () => void;
}

export function StickyActions({ saving, onCancel, onReset, onSave }: StickyActionsProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/40 bg-background/95 backdrop-blur-sm px-6 lg:px-8 py-3 flex items-center justify-between">
      <Button
        variant="ghost"
        className="text-muted-foreground hover:text-foreground gap-2"
        onClick={onReset}
        disabled={saving}
      >
        <RotateCcw className="size-4" />
        Reset
      </Button>
      <div className="flex items-center gap-2">
        <Button variant="outline" className="border-border/40 gap-2" onClick={onCancel} disabled={saving}>
          <X className="size-4" />
          Cancel
        </Button>
        <Button onClick={onSave} disabled={saving} className="bg-green-600 hover:bg-green-500 text-white border-0 gap-2">
          <Save className="size-4" />
          {saving ? "Saving…" : "Save Strategy"}
        </Button>
      </div>
    </div>
  );
}

