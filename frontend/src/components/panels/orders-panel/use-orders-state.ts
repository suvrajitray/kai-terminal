import { useCallback, useReducer } from "react";
import type { Order } from "@/types";

interface OrdersState {
  orders: Order[];
  loading: boolean;
  error: string | null;
  cancelling: string | null;
}

type OrdersAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; orders: Order[] }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "CANCEL_START"; id: string }
  | { type: "CANCEL_DONE" }
  | { type: "CANCEL_ERROR"; error: string };

function ordersReducer(state: OrdersState, action: OrdersAction): OrdersState {
  switch (action.type) {
    case "LOAD_START":   return { ...state, loading: true, error: null };
    case "LOAD_SUCCESS": return { ...state, loading: false, orders: action.orders };
    case "LOAD_ERROR":   return { ...state, loading: false, error: action.error };
    case "CANCEL_START": return { ...state, cancelling: action.id };
    case "CANCEL_DONE":  return { ...state, cancelling: null };
    case "CANCEL_ERROR": return { ...state, cancelling: null, error: action.error };
    default: return state;
  }
}

export function useOrdersState() {
  const [state, dispatch] = useReducer(ordersReducer, { orders: [], loading: false, error: null, cancelling: null });

  const loadStart   = useCallback(() => dispatch({ type: "LOAD_START" }), []);
  const loadSuccess = useCallback((orders: Order[]) => dispatch({ type: "LOAD_SUCCESS", orders }), []);
  const loadError   = useCallback((error: string) => dispatch({ type: "LOAD_ERROR", error }), []);
  const cancelStart = useCallback((id: string) => dispatch({ type: "CANCEL_START", id }), []);
  const cancelDone  = useCallback(() => dispatch({ type: "CANCEL_DONE" }), []);
  const cancelError = useCallback((error: string) => dispatch({ type: "CANCEL_ERROR", error }), []);

  return { ...state, loadStart, loadSuccess, loadError, cancelStart, cancelDone, cancelError };
}
