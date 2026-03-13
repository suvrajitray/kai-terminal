import { motion } from "motion/react";
import { PnlCell } from "@/components/panels/positions-panel/position-row";
import { useValueFlash } from "@/hooks/use-value-flash";

interface MtmDisplayProps {
  value: number;
}

const FLASH_BG: Record<"up" | "down", string> = {
  up:   "rgba(34, 197, 94, 0.15)",   // green-500 tint
  down: "rgba(239, 68, 68, 0.15)",   // red-500 tint
};

export function MtmDisplay({ value }: MtmDisplayProps) {
  const flash = useValueFlash(value);

  return (
    <motion.span
      className="flex items-center gap-1 rounded px-1 text-sm font-semibold"
      animate={{
        backgroundColor: flash ? FLASH_BG[flash] : "rgba(0,0,0,0)",
      }}
      transition={{ duration: flash ? 0.1 : 0.5 }}
    >
      MTM <PnlCell value={value} />
    </motion.span>
  );
}
