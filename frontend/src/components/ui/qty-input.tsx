import { ChevronDown, ChevronUp, Layers, Box, ArrowUpAZ, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type QtyMode = "qty" | "lot";

interface QtyInputProps {
  value: string;
  mode: QtyMode;
  lotSize: number;
  onChange: (v: string) => void;
  onToggleMode: () => void;
  /** When provided, shows a "fill all" button that sets this value */
  fillQty?: number;
  /** Where to show the lot↔qty hint: "bottom" (default) or "left" (position rows) */
  hintPosition?: "bottom" | "left";
  className?: string;
}

export function QtyInput({
  value, mode, lotSize, onChange, onToggleMode, fillQty, hintPosition = "bottom", className,
}: QtyInputProps) {
  const lot  = Math.max(lotSize, 1);
  const step = mode === "qty" ? lot : 1;
  const num  = parseInt(value, 10);

  const handleBlur = () => {
    if (value === "" || mode !== "qty" || lot <= 1) return;
    const raw     = num || lot;
    const snapped = Math.max(lot, Math.floor(raw / lot) * lot);
    if (snapped !== raw) onChange(String(snapped));
  };

  const handleDecrement = () => {
    const cur  = isNaN(num) ? 0 : num;
    const next = Math.max(0, cur - step);
    onChange(next === 0 ? "" : String(next));
  };

  const handleIncrement = () => {
    const cur = isNaN(num) ? 0 : num;
    onChange(String(cur + step));
  };

  const hint =
    value === "" || isNaN(num) ? null
    : mode === "lot" ? `${num * lot} qty`
    : lot > 1 ? `${Math.floor(num / lot)} lot`
    : null;

  const inputEl = (
    <div className="flex h-9 items-stretch overflow-hidden rounded border border-border bg-background focus-within:ring-1 focus-within:ring-ring">
        {/* Lot / Qty toggle */}
        <button
          type="button"
          onClick={onToggleMode}
          title={mode === "qty" ? "Switch to lots" : "Switch to qty"}
          className="flex h-9 w-8 shrink-0 cursor-pointer items-center justify-center border-r border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {mode === "qty" ? <Layers className="size-3.5" /> : <Box className="size-3.5" />}
        </button>

        {/* Fill all — position rows only */}
        {fillQty !== undefined && (
          <button
            type="button"
            onClick={() => {
              const filled = mode === "lot" ? String(Math.round(fillQty / lot)) : String(fillQty);
              onChange(filled);
            }}
            title="Fill all qty"
            className="flex h-9 w-8 shrink-0 cursor-pointer items-center justify-center border-r border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowUpAZ className="size-3.5" />
          </button>
        )}

        {/* Number input */}
        <input
          type="number"
          min="0"
          value={value}
          placeholder={mode === "qty" ? "Qty" : "Lot"}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          className="w-16 flex-1 bg-transparent py-1 pl-2 pr-1 text-sm tabular-nums placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:outline-none"
        />

        {/* Clear */}
        <button
          type="button"
          onClick={() => onChange("")}
          title="Clear"
          className="flex h-9 w-7 shrink-0 cursor-pointer items-center justify-center text-muted-foreground/40 transition-colors hover:text-muted-foreground"
        >
          <X className="size-3" />
        </button>

        {/* Up / Down */}
        <div className="flex flex-col border-l border-border">
          <button
            type="button"
            onClick={handleIncrement}
            className="flex flex-1 cursor-pointer items-center justify-center border-b border-border px-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={`+${step}`}
          >
            <ChevronUp className="size-2.5" />
          </button>
          <button
            type="button"
            onClick={handleDecrement}
            className="flex flex-1 cursor-pointer items-center justify-center px-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={`-${step}`}
          >
            <ChevronDown className="size-2.5" />
          </button>
        </div>
      </div>
  );

  if (hintPosition === "left") {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <span className="w-12 text-right text-[10px] tabular-nums text-muted-foreground/60">
          {hint ?? ""}
        </span>
        {inputEl}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {inputEl}
      <p className="h-3.5 pl-0.5 text-[10px] tabular-nums text-muted-foreground/60">
        {hint ?? ""}
      </p>
    </div>
  );
}
