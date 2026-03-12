import { ChevronDown, ChevronUp, Layers, Box, ArrowUpToLine, X } from "lucide-react";

export type QtyMode = "qty" | "lot";

interface QtyInputProps {
  value: string;
  mode: QtyMode;
  multiplier: number;
  positionQty: number;
  onChange: (v: string) => void;
  onToggleMode: () => void;
}

export function QtyInput({ value, mode, multiplier, positionQty, onChange, onToggleMode }: QtyInputProps) {
  const lot = Math.max(multiplier, 1);
  const step = mode === "qty" ? lot : 1;
  const num = parseInt(value, 10);

  const handleBlur = () => {
    if (value === "" || mode !== "qty" || lot <= 1) return;
    const raw = num || lot;
    const snapped = Math.max(lot, Math.floor(raw / lot) * lot);
    if (snapped !== raw) onChange(String(snapped));
  };

  const handleDecrement = () => {
    const cur = isNaN(num) ? 0 : num;
    const next = Math.max(0, cur - step);
    onChange(next === 0 ? "" : String(next));
  };

  const handleIncrement = () => {
    const cur = isNaN(num) ? 0 : num;
    onChange(String(cur + step));
  };

  const hintText =
    value === ""
      ? "\u00a0"
      : mode === "lot"
        ? `${num * lot} qty.`
        : lot > 1
          ? `${Math.floor(num / lot)} lot`
          : "\u00a0";

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="text-[10px] leading-none text-muted-foreground">
        {mode === "qty" ? "Qty." : "Lots"}
      </span>
      <div className="flex items-stretch overflow-hidden rounded border border-border bg-background focus-within:ring-1 focus-within:ring-ring">
        <button
          type="button"
          onClick={onToggleMode}
          title={mode === "qty" ? "Switch to lots" : "Switch to qty"}
          className="flex items-center border-r border-border px-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {mode === "qty" ? <Layers className="size-3" /> : <Box className="size-3" />}
        </button>
        <button
          type="button"
          onClick={() => {
            const lot = Math.max(multiplier, 1);
            const filled = mode === "lot" ? String(Math.round(positionQty / lot)) : String(positionQty);
            onChange(filled);
          }}
          title="Fill all qty"
          className="flex items-center border-r border-border px-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowUpToLine className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => onChange("")}
          title="Clear"
          className="flex items-center border-r border-border px-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3" />
        </button>
        <input
          type="number"
          min="0"
          value={value}
          placeholder=""
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          className="w-12 bg-transparent py-1 pl-1.5 pr-0.5 text-right text-xs tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:outline-none"
        />
        <div className="flex flex-col border-l border-border">
          <button
            type="button"
            onClick={handleIncrement}
            className="flex flex-1 items-center justify-center border-b border-border px-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={`+${step}`}
          >
            <ChevronUp className="size-2.5" />
          </button>
          <button
            type="button"
            onClick={handleDecrement}
            className="flex flex-1 items-center justify-center px-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={`-${step}`}
          >
            <ChevronDown className="size-2.5" />
          </button>
        </div>
      </div>
      <span className="text-[10px] leading-none text-muted-foreground">{hintText}</span>
    </div>
  );
}
