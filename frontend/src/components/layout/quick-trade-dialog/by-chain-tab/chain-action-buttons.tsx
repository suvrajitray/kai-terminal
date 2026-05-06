import { ArrowUpDown, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActionType } from "./types";

interface ChainActionButtonsProps {
  acting: ActionType | null;
  disabled: boolean;
  isBuy: boolean;
  onExecute: (action: ActionType) => void;
}

const ACTIONS: ActionType[] = ["CE", "PE", "BOTH"];

export function ChainActionButtons({ acting, disabled, isBuy, onExecute }: ChainActionButtonsProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ACTIONS.map((action) => {
        const Icon =
          action === "BOTH"
            ? ArrowUpDown
            : action === "CE"
              ? isBuy ? TrendingUp : TrendingDown
              : isBuy ? TrendingDown : TrendingUp;

        return (
          <Button
            key={action}
            disabled={acting !== null || disabled}
            onClick={() => onExecute(action)}
            className={cn(
              "h-9 font-semibold text-sm gap-1.5",
              isBuy ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white",
            )}
          >
            {acting === action ? (
              <>
                <Zap className="size-3.5 animate-pulse" />
                Placing…
              </>
            ) : (
              <>
                <Icon className="size-4" />
                {action === "BOTH" ? "CE + PE" : action}
              </>
            )}
          </Button>
        );
      })}
    </div>
  );
}

