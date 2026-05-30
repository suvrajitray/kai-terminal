import { lazy, Suspense } from "react";
import type { OrderDialogProps } from "./order-dialog";

export type { OrderIntent } from "./order-dialog";

const OrderDialog = lazy(() =>
  import("./order-dialog").then((m) => ({ default: m.OrderDialog })),
);

export function OrderDialogLazy(props: OrderDialogProps) {
  if (!props.intent) return null;
  return (
    <Suspense fallback={null}>
      <OrderDialog {...props} />
    </Suspense>
  );
}
