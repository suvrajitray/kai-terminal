// frontend/src/components/layout/basket-dialog/index.tsx
import { ShoppingCart, CircleX } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useBasketStore } from "@/stores/basket-store";
import { BasketItemRow } from "./basket-item-row";

interface BasketDialogProps {
  open: boolean;
  onClose: () => void;
}

export function BasketDialog({ open, onClose }: BasketDialogProps) {
  const items = useBasketStore((s) => s.items);
  const removeItem = useBasketStore((s) => s.removeItem);
  const updateItem = useBasketStore((s) => s.updateItem);
  const clearBasket = useBasketStore((s) => s.clearBasket);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[960px] p-0 gap-0 overflow-hidden" showCloseButton={false}>
        <DialogTitle className="sr-only">Basket</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Basket</span>
            <span className="text-xs text-muted-foreground">
              {items.length} / 20 items
            </span>
          </div>
          {items.length > 0 && (
            <button
              onClick={clearBasket}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <CircleX className="size-3.5" />
              Clear basket
            </button>
          )}
        </div>

        {/* Table */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <ShoppingCart className="size-8 opacity-20" />
            <p className="text-sm">Basket is empty</p>
            <p className="text-xs opacity-60">Add instruments from the option chain or positions panel</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="pl-3 py-2 w-7">{/* select-all placeholder */}</th>
                  <th className="px-2 py-2 w-8"></th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Instrument
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    LTP
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Order type
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Product
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Qty (lots)
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Price
                  </th>
                  <th className="w-8 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <BasketItemRow
                    key={item.id}
                    item={item}
                    onUpdate={(patch) => updateItem(item.id, patch)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border/40 bg-muted/10">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            Close
          </button>
          <button
            disabled={items.length === 0}
            className="px-5 py-1.5 rounded bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            Place all
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
