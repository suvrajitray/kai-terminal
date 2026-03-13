import { Layers, Box } from "lucide-react";

export type QtyMode = "lot" | "qty";

interface QuickTradeQtyInputProps {
  value: string;
  mode: QtyMode;
  lotSize: number;
  onChange: (v: string) => void;
  onToggleMode: () => void;
}

export function QuickTradeQtyInput({ value, mode, lotSize, onChange, onToggleMode }: QuickTradeQtyInputProps) {
  const num = parseInt(value, 10);
  const hint =
    !value || isNaN(num) || num <= 0
      ? "\u00a0"
      : mode === "lot"
        ? `${num * lotSize} qty`
        : lotSize > 1
          ? `${Math.floor(num / lotSize)} lot`
          : "\u00a0";

  return (
    <div className="space-y-1">
      <div className="flex items-stretch overflow-hidden rounded-md border border-border bg-background focus-within:ring-1 focus-within:ring-ring h-9">
        <input
          type="number"
          min={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (mode !== "qty" || lotSize <= 1 || !value) return;
            const raw = parseInt(value, 10) || lotSize;
            const snapped = Math.max(lotSize, Math.floor(raw / lotSize) * lotSize);
            if (snapped !== raw) onChange(String(snapped));
          }}
          placeholder={mode === "qty" ? "Qty" : "Lot"}
          className="flex-1 min-w-0 bg-transparent px-3 text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:outline-none"
        />
        <button
          type="button"
          onClick={onToggleMode}
          title={mode === "qty" ? "Switch to lots" : "Switch to qty"}
          className="flex items-center border-l border-border px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {mode === "qty" ? <Layers className="size-3.5" /> : <Box className="size-3.5" />}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground/70 pl-0.5">{hint}</p>
    </div>
  );
}
