import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBasketStore } from "@/stores/basket-store";
import { BasketDialog } from "./basket-dialog";

export function BasketButton() {
  const [open, setOpen] = useState(false);
  const count = useBasketStore((s) => s.items.length);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
          count > 0
            ? "text-foreground hover:bg-accent"
            : "text-muted-foreground hover:text-foreground hover:bg-accent",
        )}
        title="Basket"
      >
        <ShoppingCart className="size-4" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {count}
          </span>
        )}
      </button>
      <BasketDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
