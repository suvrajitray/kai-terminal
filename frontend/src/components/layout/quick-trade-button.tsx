import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { QuickTradeDialog } from "./quick-trade-dialog";

export function QuickTradeButton() {
  const [open, setOpen]         = useState(false);
  const [activeTab, setActiveTab] = useState("price");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "q" || e.key === "Q") {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        className="gap-1.5 font-semibold bg-amber-500 hover:bg-amber-600 text-black"
        onClick={() => setOpen(true)}
      >
        <Zap className="size-3.5" />
        Quick Trade
        <kbd className="ml-0.5 hidden rounded bg-black/20 px-1 text-[10px] font-normal sm:inline">Q</kbd>
      </Button>
      <DialogContent
        className={cn(
          "transition-[max-width] duration-200 max-h-[calc(100dvh-2rem)] overflow-y-auto",
          activeTab === "chain" ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-4 text-amber-500" />
            Quick Trade
          </DialogTitle>
        </DialogHeader>
        <QuickTradeDialog onTabChange={setActiveTab} />
      </DialogContent>
    </Dialog>
  );
}
