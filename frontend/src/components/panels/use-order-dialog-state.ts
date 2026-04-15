import { useEffect, useReducer, useState } from "react";
import { fetchFunds, fetchZerodhaFunds } from "@/services/trading-api";
import { useBrokerStore } from "@/stores/broker-store";

type SupportedBroker = "upstox" | "zerodha";

export interface OrderDialogFormState {
  broker: SupportedBroker;
  direction: "Buy" | "Sell";
  qtyValue: string;
  qtyMode: "qty" | "lot";
  product: "Intraday" | "Delivery";
  orderType: "market" | "limit";
  limitPrice: string;
}

type OrderDialogFormAction =
  | { type: "RESET"; payload: OrderDialogFormState }
  | { type: "SET_BROKER"; broker: SupportedBroker }
  | { type: "SET_DIRECTION"; direction: "Buy" | "Sell" }
  | { type: "SET_QTY_VALUE"; value: string }
  | { type: "SET_QTY_MODE"; mode: "qty" | "lot"; newValue: string }
  | { type: "SET_PRODUCT"; product: "Intraday" | "Delivery" }
  | { type: "SET_ORDER_TYPE"; orderType: "market" | "limit"; limitPrice?: string }
  | { type: "SET_LIMIT_PRICE"; price: string };

function formReducer(state: OrderDialogFormState, action: OrderDialogFormAction): OrderDialogFormState {
  switch (action.type) {
    case "RESET":
      return action.payload;
    case "SET_BROKER":
      return { ...state, broker: action.broker };
    case "SET_DIRECTION":
      return { ...state, direction: action.direction };
    case "SET_QTY_VALUE":
      return { ...state, qtyValue: action.value };
    case "SET_QTY_MODE":
      return { ...state, qtyMode: action.mode, qtyValue: action.newValue };
    case "SET_PRODUCT":
      return { ...state, product: action.product };
    case "SET_ORDER_TYPE":
      return {
        ...state,
        orderType: action.orderType,
        ...(action.limitPrice !== undefined ? { limitPrice: action.limitPrice } : {}),
      };
    case "SET_LIMIT_PRICE":
      return { ...state, limitPrice: action.price };
    default:
      return state;
  }
}

interface OrderDialogDefaultsArgs {
  activeBrokerId?: string;
  intent: {
    instrumentKey?: string;
    transactionType: "Buy" | "Sell";
    ltp: number;
  } | null;
  lockedBroker?: string;
  lockedProduct?: "Intraday" | "Delivery";
  defaultQtyOverride?: { value: number; mode: "qty" | "lot" };
}

export function getOrderDialogDefaults({
  activeBrokerId,
  intent,
  lockedBroker,
  lockedProduct,
  defaultQtyOverride,
}: OrderDialogDefaultsArgs): OrderDialogFormState {
  const broker = (lockedBroker ?? activeBrokerId ?? "upstox") as SupportedBroker;
  return {
    broker,
    direction: intent?.transactionType ?? "Buy",
    qtyValue: defaultQtyOverride ? String(defaultQtyOverride.value) : "1",
    qtyMode: defaultQtyOverride?.mode ?? "lot",
    product: lockedProduct ?? "Intraday",
    orderType: "market",
    limitPrice: intent?.ltp.toFixed(2) ?? "0",
  };
}

export function useOrderDialogForm(args: OrderDialogDefaultsArgs) {
  const defaultState = getOrderDialogDefaults(args);
  const [form, dispatch] = useReducer(formReducer, defaultState);
  const activeBrokerId = args.activeBrokerId;
  const qtyMode = args.defaultQtyOverride?.mode;
  const qtyValue = args.defaultQtyOverride?.value;
  const instrumentKey = args.intent?.instrumentKey;
  const ltp = args.intent?.ltp;
  const transactionType = args.intent?.transactionType;
  const lockedBroker = args.lockedBroker;
  const lockedProduct = args.lockedProduct;

  useEffect(() => {
    dispatch({
      type: "RESET",
      payload: getOrderDialogDefaults({
        activeBrokerId,
        intent: ltp == null || transactionType == null
          ? null
          : { instrumentKey, ltp, transactionType },
        lockedBroker,
        lockedProduct,
        defaultQtyOverride: qtyValue == null || qtyMode == null
          ? undefined
          : { value: qtyValue, mode: qtyMode },
      }),
    });
  // intentionally exclude ltp: live LTP ticks must not reset the form
  // (user may have switched to limit mode; resetting would revert to market)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeBrokerId,
    qtyMode,
    qtyValue,
    instrumentKey,
    transactionType,
    lockedBroker,
    lockedProduct,
  ]);

  return { form, dispatch };
}

export function useAvailableMargin(broker: SupportedBroker, open: boolean) {
  const [availableMargin, setAvailableMargin] = useState<{
    broker: SupportedBroker | null;
    value: number | null;
  }>({ broker: null, value: null });

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const creds = useBrokerStore.getState().getCredentials(broker);
    const loadMargin = async () => {
      try {
        if (broker === "zerodha" && creds?.apiKey && creds?.accessToken) {
          const funds = await fetchZerodhaFunds(creds.apiKey, creds.accessToken);
          if (!cancelled) {
            setAvailableMargin({ broker, value: funds.availableMargin });
          }
          return;
        }

        if (broker === "upstox") {
          const funds = await fetchFunds();
          if (!cancelled) {
            setAvailableMargin({ broker, value: funds.availableMargin });
          }
        }
      } catch {
        if (!cancelled) {
          setAvailableMargin({ broker, value: null });
        }
      }
    };

    void loadMargin();

    return () => {
      cancelled = true;
    };
  }, [broker, open]);

  if (!open || availableMargin.broker !== broker) {
    return null;
  }

  return availableMargin.value;
}
