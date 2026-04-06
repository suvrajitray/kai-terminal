import { Plus, Minus, ArrowUp, ArrowDown, MoreHorizontal, TrendingDown, TrendingUp, RefreshCw, ShieldAlert, LogOut } from "lucide-react";
import { QtyInput, type QtyMode } from "./qty-input";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PositionActionsProps {
  qtyValue: string;
  qtyMode: QtyMode;
  multiplier: number;
  actualQty: number;
  positionQty: number;
  acting: string | null;
  hasOpenQty: boolean;
  isSell: boolean;
  showConvert?: boolean;
  onQtyChange: (v: string) => void;
  onToggleMode: () => void;
  onAdd: () => void;
  onReduce: () => void;
  onShiftUp: () => void;
  onShiftDown: () => void;
  onExitDialog: () => void;
  onSellMore: () => void;
  onConvert: () => void;
  onAddStoploss: () => void;
}

interface ActionBtnProps {
  onClick: () => void;
  disabled: boolean;
  title: string;
  className?: string;
  children: React.ReactNode;
}

function ActionBtn({ onClick, disabled, title, className, children }: ActionBtnProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "flex cursor-pointer items-center justify-center px-2 py-1.5 text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30",
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{title}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function PositionActions({
  qtyValue,
  qtyMode,
  multiplier,
  actualQty,
  positionQty,
  acting,
  hasOpenQty,
  isSell,
  showConvert = true,
  onQtyChange,
  onToggleMode,
  onAdd,
  onReduce,
  onShiftUp,
  onShiftDown,
  onExitDialog,
  onSellMore,
  onConvert,
  onAddStoploss,
}: PositionActionsProps) {
  const disabled    = !!acting;
  const qtyDisabled = disabled || actualQty === 0;

  return (
    <div className="flex items-center justify-end gap-2">
      <QtyInput
        value={qtyValue}
        mode={qtyMode}
        lotSize={multiplier}
        fillQty={positionQty}
        hintPosition="left"
        onChange={onQtyChange}
        onToggleMode={onToggleMode}
      />

      {/* Grouped action toolbar */}
      <div className="flex h-9 items-stretch overflow-hidden rounded border border-border/50 bg-muted/20">

        {/* Add / Reduce */}
        <ActionBtn onClick={onAdd} disabled={qtyDisabled} title="Add" className="text-green-500 hover:text-green-400 hover:bg-green-500/10">
          <Plus className="size-3.5" />
        </ActionBtn>
        <div className="w-px bg-border/50" />
        <ActionBtn onClick={onReduce} disabled={qtyDisabled} title="Reduce" className="text-red-500 hover:text-red-400 hover:bg-red-500/10">
          <Minus className="size-3.5" />
        </ActionBtn>

        <div className="w-px bg-border/50 mx-0.5" />

        {/* Shift Up / Down */}
        <ActionBtn onClick={onShiftUp} disabled={qtyDisabled} title="Shift Up" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">
          <ArrowUp className="size-3.5" />
        </ActionBtn>
        <div className="w-px bg-border/50" />
        <ActionBtn onClick={onShiftDown} disabled={qtyDisabled} title="Shift Down" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">
          <ArrowDown className="size-3.5" />
        </ActionBtn>

        <div className="w-px bg-border/50 mx-0.5" />

        {/* More actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={disabled || !hasOpenQty}
              className={cn(
                "flex cursor-pointer items-center justify-center px-2 py-1.5 text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30",
              )}
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onSellMore} className="gap-2 cursor-pointer">
              {isSell ? (
                <TrendingDown className="size-3.5 text-red-400" />
              ) : (
                <TrendingUp className="size-3.5 text-green-400" />
              )}
              <span>{isSell ? "Sell more" : "Buy more"}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={onExitDialog}
              className="gap-2 cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-500/10"
            >
              <LogOut className="size-3.5" />
              <span>Exit position</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onAddStoploss} className="gap-2 cursor-pointer text-amber-400 focus:text-amber-400 focus:bg-amber-500/10">
              <ShieldAlert className="size-3.5" />
              <span>Add stoploss</span>
            </DropdownMenuItem>

            {showConvert && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onConvert} className="gap-2 cursor-pointer text-muted-foreground">
                  <RefreshCw className="size-3.5" />
                  <span>Convert position</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
