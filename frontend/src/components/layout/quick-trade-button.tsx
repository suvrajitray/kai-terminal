import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { QuickTradeDialog } from "./quick-trade-dialog";

export function QuickTradeButton() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 font-semibold">
          <Zap className="size-3.5" />
          Quick Trade
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            Quick Trade
          </DialogTitle>
        </DialogHeader>
        <QuickTradeDialog />
      </DialogContent>
    </Dialog>
  );
}
