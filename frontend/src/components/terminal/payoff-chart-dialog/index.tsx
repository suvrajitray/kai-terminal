import { BarChart2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePayoffData } from "./use-payoff-data";
import { PayoffChart } from "./payoff-chart";
import type { Position } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positions: Position[];
}

export function PayoffChartDialog({ open, onOpenChange, positions }: Props) {
  const { groups, indexName, spot } = usePayoffData(positions);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[580px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <BarChart2 className="size-4" />
            P&amp;L at Expiry
            {indexName && (
              <span className="text-muted-foreground font-normal">— {indexName}</span>
            )}
          </DialogTitle>
        </DialogHeader>
        <PayoffChart groups={groups} spot={spot} indexName={indexName} />
      </DialogContent>
    </Dialog>
  );
}
