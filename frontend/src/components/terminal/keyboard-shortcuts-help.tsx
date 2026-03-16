import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const SHORTCUTS = [
  { key: "R", description: "Refresh positions" },
  { key: "E", description: "Exit all positions" },
  { key: "Q", description: "Open Quick Trade" },
  { key: "?", description: "Show this help" },
];

export function KeyboardShortcutsHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-6 rounded-full text-[11px] font-semibold text-muted-foreground"
          title="Keyboard shortcuts"
        >
          ?
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Keyboard Shortcuts
        </p>
        <div className="space-y-1.5">
          {SHORTCUTS.map(({ key, description }) => (
            <div key={key} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{description}</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
