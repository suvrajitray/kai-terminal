import { Plus, Minus, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QtyInput, type QtyMode } from "./qty-input";

interface PositionActionsProps {
  qtyValue: string;
  qtyMode: QtyMode;
  multiplier: number;
  actualQty: number;
  positionQty: number;
  acting: string | null;
  hasOpenQty: boolean;
  onQtyChange: (v: string) => void;
  onToggleMode: () => void;
  onAdd: () => void;
  onReduce: () => void;
  onShiftUp: () => void;
  onShiftDown: () => void;
  onExit: () => void;
}

export function PositionActions({
  qtyValue,
  qtyMode,
  multiplier,
  actualQty,
  positionQty,
  acting,
  hasOpenQty,
  onQtyChange,
  onToggleMode,
  onAdd,
  onReduce,
  onShiftUp,
  onShiftDown,
  onExit,
}: PositionActionsProps) {
  const disabled = !!acting;
  const qtyDisabled = disabled || actualQty === 0;

  return (
    <div className="flex items-center justify-end gap-1">
      <QtyInput
        value={qtyValue}
        mode={qtyMode}
        multiplier={multiplier}
        positionQty={positionQty}
        onChange={onQtyChange}
        onToggleMode={onToggleMode}
      />
      <Button
        size="icon"
        variant="ghost"
        className="size-8 text-green-500 hover:bg-green-500/10 hover:text-green-400"
        onClick={onAdd}
        disabled={qtyDisabled}
        title="Add"
      >
        <Plus className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-8 text-red-500 hover:bg-red-500/10 hover:text-red-400"
        onClick={onReduce}
        disabled={qtyDisabled}
        title="Reduce"
      >
        <Minus className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-8 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
        onClick={onShiftUp}
        disabled={qtyDisabled}
        title="Shift Up"
      >
        <ArrowUp className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-8 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
        onClick={onShiftDown}
        disabled={qtyDisabled}
        title="Shift Down"
      >
        <ArrowDown className="size-4" />
      </Button>
      {hasOpenQty ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-destructive hover:text-destructive"
          onClick={onExit}
          disabled={disabled}
        >
          Exit
        </Button>
      ) : (
        <span className="size-8 inline-block" />
      )}
    </div>
  );
}
