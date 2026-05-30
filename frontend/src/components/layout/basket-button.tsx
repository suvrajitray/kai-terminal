import { lazy, Suspense, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBasketStore } from "@/stores/basket-store";

const BasketDialog = lazy(() =>
  import("./basket-dialog").then((m) => ({ default: m.BasketDialog })),
);

export function BasketButton() {
  const [open, setOpen] = useState(false);
  // Mount the dialog once on first open and keep it mounted so Radix can play
  // its close transition when `open` flips back to false.
  const [hasOpened, setHasOpened] = useState(false);
  const count = useBasketStore((s) => s.items.length);

  return (
    <>
      <button
        onClick={() => { setHasOpened(true); setOpen(true); }}
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
      {hasOpened && (
        <Suspense fallback={null}>
          <BasketDialog open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
