import { useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { placeOrder, type MarginInstrument } from "@/services/trading-api";
import { useBrokerStore } from "@/stores/broker-store";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { getLotSize } from "@/lib/lot-sizes";
import { BROKERS } from "@/lib/constants";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { useDirectMarginEstimate } from "@/components/layout/use-margin-estimate";
import { useAvailableMargin, useOrderDialogForm } from "./use-order-dialog-state";
import { BrokerRoutingSection } from "./order-dialog-parts/broker-routing-section";
import { OrderDialogFooter } from "./order-dialog-parts/order-dialog-footer";
import { OrderDialogHeader } from "./order-dialog-parts/order-dialog-header";
import { getMarginColor, getOrderAccent, getOrderQuantity } from "./order-dialog-parts/order-dialog-utils";
import { QuantityPriceSection } from "./order-dialog-parts/quantity-price-section";
import type { ProductType, SupportedBroker } from "./order-dialog-parts/types";

export interface OrderIntent {
  instrumentKey: string;
  side: "CE" | "PE";
  transactionType: "Buy" | "Sell";
  ltp: number;
  strike: number;
  underlying: string;
  /** ISO expiry date "YYYY-MM-DD". Carried by position-originated intents to avoid a re-lookup. */
  expiry?: string;
}

interface Props {
  intent: OrderIntent | null;
  currentLtp?: number;
  onClose: () => void;
  /** When set, hides the broker routing toggle and locks to this broker. */
  lockedBroker?: string;
  /** When set, hides the product radio buttons and locks to this product. */
  lockedProduct?: "Intraday" | "Delivery";
  /** When true, hides the Buy/Sell direction toggle. */
  hideDirectionToggle?: boolean;
  /** Overrides the initial qty value and mode. Defaults to 1 lot when not set. */
  defaultQtyOverride?: { value: number; mode: "qty" | "lot" };
}

export function OrderDialog({
  intent,
  currentLtp,
  onClose,
  lockedBroker,
  lockedProduct,
  hideDirectionToggle,
  defaultQtyOverride,
}: Props) {
  const credentials        = useBrokerStore((s) => s.credentials);
  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);

  const activeBrokers = BROKERS.filter(
    (b) => (b.id === "upstox" || b.id === "zerodha") && !isBrokerTokenExpired(b.id, credentials[b.id]?.accessToken),
  );
  const defaultBrokerId = activeBrokers[0]?.id;

  const { form, dispatch } = useOrderDialogForm({
    activeBrokerId: defaultBrokerId,
    intent,
    lockedBroker,
    lockedProduct,
    defaultQtyOverride,
  });
  const { broker, direction, qtyValue, qtyMode, product, orderType, limitPrice } = form;
  const [placing, setPlacing] = useState(false);
  const availableMargin = useAvailableMargin(broker, !!intent);

  // Derived values — computed before early return so hook order is stable
  const lotSize  = intent ? getLotSize(intent.underlying) : 1;
  const qty      = getOrderQuantity({ qtyValue, qtyMode, lotSize });
  const contract = intent ? getByInstrumentKey(intent.instrumentKey) : null;
  const accent = getOrderAccent(direction);

  const marginInstruments = useMemo<MarginInstrument[] | null>(() => {
    if (!intent || qty <= 0) return null;
    return [{ instrumentToken: intent.instrumentKey, quantity: qty, product: product === "Intraday" ? "I" : "D", transactionType: direction.toUpperCase() }];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.instrumentKey, qty, product, direction]);

  const { margin, loading: marginLoading } = useDirectMarginEstimate(marginInstruments, broker as "upstox" | "zerodha");
  const marginColor = getMarginColor({ margin, availableMargin });

  if (!intent) return null;

  const ltp = currentLtp ?? intent.ltp;

  const toggleMode = () => {
    const cur  = parseInt(qtyValue, 10);
    const next = qtyMode === "lot" ? "qty" : "lot";
    const newValue =
      !isNaN(cur) && cur > 0
        ? next === "qty" ? String(cur * lotSize) : String(Math.max(1, Math.round(cur / lotSize)))
        : qtyValue;
    dispatch({ type: "SET_QTY_MODE", mode: next, newValue });
  };

  async function handlePlace() {
    setPlacing(true);
    try {
      let token = intent!.instrumentKey;
      if (broker === "zerodha" && contract?.contract.zerodhaToken) {
        token = contract.contract.zerodhaToken;
      }
      const price = orderType === "limit" ? parseFloat(limitPrice) : undefined;
      await placeOrder(token, qty, direction, product, orderType, price, broker);
      toast.success(`${direction} order placed`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPlacing(false);
    }
  }

  const brokerLabel = broker === "upstox" ? "Upstox" : "Zerodha";
  const expiry = intent.expiry ?? contract?.contract.expiry;

  return (
    <Dialog open={!!intent} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden" showCloseButton={false}>

        <DialogTitle className="sr-only">
          {direction} {intent.underlying} {intent.strike} {intent.side}
        </DialogTitle>

        <div className="px-5 pt-5 pb-4 space-y-5">
          <OrderDialogHeader
            intent={intent}
            expiry={expiry}
            ltp={ltp}
            direction={direction}
            accent={accent}
            hideDirectionToggle={hideDirectionToggle}
            onDirectionChange={(nextDirection) => dispatch({ type: "SET_DIRECTION", direction: nextDirection })}
          />

          <BrokerRoutingSection
            lockedBroker={lockedBroker}
            activeBrokers={activeBrokers}
            broker={broker}
            brokerLabel={brokerLabel}
            product={product}
            accent={accent}
            onBrokerChange={(nextBroker: SupportedBroker) => dispatch({ type: "SET_BROKER", broker: nextBroker })}
            onProductChange={(nextProduct: ProductType) => dispatch({ type: "SET_PRODUCT", product: nextProduct })}
          />

          <QuantityPriceSection
            qtyValue={qtyValue}
            qtyMode={qtyMode}
            lotSize={lotSize}
            orderType={orderType}
            limitPrice={limitPrice}
            ltp={ltp}
            onQtyChange={(value) => dispatch({ type: "SET_QTY_VALUE", value })}
            onToggleQtyMode={toggleMode}
            onLimitPriceChange={(price) => dispatch({ type: "SET_LIMIT_PRICE", price })}
            onOrderTypeChange={(nextOrderType, nextLimitPrice) => dispatch({ type: "SET_ORDER_TYPE", orderType: nextOrderType, limitPrice: nextLimitPrice })}
          />
        </div>

        <OrderDialogFooter
          direction={direction}
          accent={accent}
          placing={placing}
          margin={margin}
          marginLoading={marginLoading}
          marginColor={marginColor}
          availableMargin={availableMargin}
          onPlace={handlePlace}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
