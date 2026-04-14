import { useCallback, useEffect, useMemo, useReducer } from "react";
import { getLotSize } from "@/lib/lot-sizes";
import { useBrokerStore } from "@/stores/broker-store";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { type QtyMode } from "@/components/ui/qty-input";

type QuickTradeBroker = "upstox" | "zerodha";

interface TradeFormState {
  broker: QuickTradeBroker;
  underlying: string;
  expiry: string;
  qtyValue: string;
  qtyMode: QtyMode;
  product: "I" | "D";
  activeTab: string;
}

type TradeFormAction =
  | { type: "SET_BROKER"; broker: QuickTradeBroker }
  | { type: "SET_UNDERLYING"; underlying: string }
  | { type: "SET_EXPIRY"; expiry: string }
  | { type: "SET_QTY_VALUE"; value: string }
  | { type: "SET_QTY_MODE"; mode: QtyMode; newValue: string }
  | { type: "SET_PRODUCT"; product: "I" | "D" }
  | { type: "SET_TAB"; tab: string };

function tradeFormReducer(state: TradeFormState, action: TradeFormAction): TradeFormState {
  switch (action.type) {
    case "SET_BROKER":
      return { ...state, broker: action.broker };
    case "SET_UNDERLYING":
      return { ...state, underlying: action.underlying };
    case "SET_EXPIRY":
      return { ...state, expiry: action.expiry };
    case "SET_QTY_VALUE":
      return { ...state, qtyValue: action.value };
    case "SET_QTY_MODE":
      return { ...state, qtyMode: action.mode, qtyValue: action.newValue };
    case "SET_PRODUCT":
      return { ...state, product: action.product };
    case "SET_TAB":
      return { ...state, activeTab: action.tab };
    default:
      return state;
  }
}

export function useQuickTradeForm() {
  const isUpstoxAuthed = useBrokerStore((s) => s.isAuthenticated("upstox"));
  const isZerodhaAuthed = useBrokerStore((s) => s.isAuthenticated("zerodha"));
  const bothConnected = isUpstoxAuthed && isZerodhaAuthed;

  const [form, dispatch] = useReducer(tradeFormReducer, {
    broker: isUpstoxAuthed ? "upstox" : "zerodha",
    underlying: "NIFTY",
    expiry: "",
    qtyValue: "",
    qtyMode: "lot",
    product: "I",
    activeTab: "price",
  });

  const getExpiries = useOptionContractsStore((s) => s.getExpiries);
  const expiries = getExpiries(form.underlying);

  useEffect(() => {
    const nextExpiry = expiries.includes(form.expiry) ? form.expiry : (expiries[0] ?? "");
    if (nextExpiry !== form.expiry) {
      dispatch({ type: "SET_EXPIRY", expiry: nextExpiry });
    }
  }, [expiries, form.expiry]);

  const lotSize = getLotSize(form.underlying);

  const quantity = useMemo(() => {
    const num = parseInt(form.qtyValue, 10);
    if (isNaN(num) || num <= 0) {
      return lotSize;
    }
    return form.qtyMode === "lot" ? num * lotSize : num;
  }, [form.qtyMode, form.qtyValue, lotSize]);

  const toggleQtyMode = useCallback(() => {
    const cur = parseInt(form.qtyValue, 10);
    const next: QtyMode = form.qtyMode === "lot" ? "qty" : "lot";
    const newValue = !isNaN(cur) && cur > 0
      ? next === "qty"
        ? String(cur * lotSize)
        : String(Math.max(1, Math.round(cur / lotSize)))
      : form.qtyValue;
    dispatch({ type: "SET_QTY_MODE", mode: next, newValue });
  }, [form.qtyMode, form.qtyValue, lotSize]);

  return {
    bothConnected,
    expiries,
    lotSize,
    quantity,
    form,
    setBroker: (broker: QuickTradeBroker) => dispatch({ type: "SET_BROKER", broker }),
    setUnderlying: (underlying: string) => dispatch({ type: "SET_UNDERLYING", underlying }),
    setExpiry: (expiry: string) => dispatch({ type: "SET_EXPIRY", expiry }),
    setQtyValue: (value: string) => dispatch({ type: "SET_QTY_VALUE", value }),
    setProduct: (product: "I" | "D") => dispatch({ type: "SET_PRODUCT", product }),
    setActiveTab: (tab: string) => dispatch({ type: "SET_TAB", tab }),
    toggleQtyMode,
  };
}
