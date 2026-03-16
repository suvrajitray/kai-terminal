import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useValueFlash } from "@/hooks/use-value-flash";
import { Card, CardContent } from "@/components/ui/card";

const INR = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 });

interface StatCardProps {
  label: string;
  value: number | null;
  index: number;
  colored?: boolean;   // green/red based on sign
  prefix?: string;     // e.g. "₹"
  flash?: boolean;     // enable MTM-style flash animation
}

const FLASH_BG: Record<"up" | "down", string> = {
  up:   "rgba(34, 197, 94, 0.12)",
  down: "rgba(239, 68, 68, 0.12)",
};

function FlashingValue({ value, colored, prefix }: { value: number; colored: boolean; prefix: string }) {
  const flash = useValueFlash(value);
  const color = colored
    ? value > 0 ? "text-green-500" : value < 0 ? "text-red-500" : "text-foreground"
    : "text-foreground";

  return (
    <motion.span
      className={cn("tabular-nums font-bold text-2xl", color)}
      animate={{ backgroundColor: flash ? FLASH_BG[flash] : "rgba(0,0,0,0)" }}
      transition={{ duration: flash ? 0.1 : 0.5 }}
      style={{ borderRadius: 4, padding: "0 2px" }}
    >
      {value >= 0 ? "" : "-"}{prefix}{INR.format(Math.abs(value))}
    </motion.span>
  );
}

export function StatCard({ label, value, index, colored = false, prefix = "", flash = false }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07 }}
    >
      <Card className="border-border/40 bg-muted/10">
        <CardContent className="pt-5 pb-5 px-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
          {value === null ? (
            <span className="text-2xl font-bold text-muted-foreground/40">—</span>
          ) : flash ? (
            <FlashingValue value={value} colored={colored} prefix={prefix} />
          ) : (
            <span
              className={cn(
                "tabular-nums font-bold text-2xl",
                colored
                  ? value > 0 ? "text-green-500" : value < 0 ? "text-red-500" : "text-foreground"
                  : "text-foreground",
              )}
            >
              {colored && value > 0 ? "+" : colored && value < 0 ? "-" : ""}
              {prefix}{INR.format(Math.abs(value))}
            </span>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** Neutral count card (no sign, no INR) */
export function CountCard({ label, value, index }: { label: string; value: number | null; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07 }}
    >
      <Card className="border-border/40 bg-muted/10">
        <CardContent className="pt-5 pb-5 px-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
          {value === null ? (
            <span className="text-2xl font-bold text-muted-foreground/40">—</span>
          ) : (
            <span className="text-2xl font-bold tabular-nums">{value}</span>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
