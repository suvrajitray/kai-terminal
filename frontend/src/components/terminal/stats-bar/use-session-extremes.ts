// frontend/src/components/terminal/stats-bar/use-session-extremes.ts
import { useReducer, useEffect } from "react";

const STORAGE_KEY = "kai-terminal-mtm-extremes";

interface ExtremesState {
  maxProfit: number | null;
  maxLoss: number | null;
}

type ExtremesAction = { type: "UPDATE"; pnl: number } | { type: "RESET" };

function readStored(): ExtremesState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { maxProfit: null, maxLoss: null };
  } catch {
    return { maxProfit: null, maxLoss: null };
  }
}

function extremesReducer(state: ExtremesState, action: ExtremesAction): ExtremesState {
  if (action.type === "RESET") return { maxProfit: null, maxLoss: null };
  const { pnl } = action;
  const maxProfit = state.maxProfit === null || pnl > state.maxProfit ? pnl : state.maxProfit;
  const maxLoss   = state.maxLoss   === null || pnl < state.maxLoss   ? pnl : state.maxLoss;
  if (maxProfit === state.maxProfit && maxLoss === state.maxLoss) return state;
  const next = { maxProfit, maxLoss };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function useSessionExtremes(allPnl: number, hasPositions: boolean) {
  const [extremes, dispatch] = useReducer(extremesReducer, undefined, readStored);

  useEffect(() => {
    if (!hasPositions) return;
    dispatch({ type: "UPDATE", pnl: allPnl });
  }, [allPnl, hasPositions]);

  return extremes;
}
