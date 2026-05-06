import { useCallback, useReducer } from "react";
import type { OptionChainEntry } from "@/types";
import type { ActionType, Direction, StrategyMode } from "./types";

interface ChainState {
  chain: OptionChainEntry[];
  loading: boolean;
  mode: StrategyMode;
  selectedDiff: number | null;
  direction: Direction;
  acting: ActionType | null;
}

type ChainAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; chain: OptionChainEntry[] }
  | { type: "LOAD_ERROR" }
  | { type: "SET_MODE"; mode: StrategyMode }
  | { type: "SET_SELECTED_DIFF"; diff: number | null }
  | { type: "SET_DIRECTION"; direction: Direction }
  | { type: "EXECUTE_START"; acting: ActionType }
  | { type: "EXECUTE_DONE" };

const initialState: ChainState = {
  chain: [],
  loading: false,
  mode: "strangle",
  selectedDiff: null,
  direction: "Sell",
  acting: null,
};

function chainReducer(state: ChainState, action: ChainAction): ChainState {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true };
    case "LOAD_SUCCESS":
      return { ...state, loading: false, chain: action.chain, selectedDiff: null };
    case "LOAD_ERROR":
      return { ...state, loading: false };
    case "SET_MODE":
      return { ...state, mode: action.mode, selectedDiff: null };
    case "SET_SELECTED_DIFF":
      return { ...state, selectedDiff: action.diff };
    case "SET_DIRECTION":
      return { ...state, direction: action.direction };
    case "EXECUTE_START":
      return { ...state, acting: action.acting };
    case "EXECUTE_DONE":
      return { ...state, acting: null };
  }
}

export function useChainState() {
  const [state, dispatch] = useReducer(chainReducer, initialState);

  // dispatch is stable across renders (React guarantee), so all wrappers get [] deps
  const startLoading  = useCallback(() => dispatch({ type: "LOAD_START" }), []);
  const loadSuccess   = useCallback((chain: OptionChainEntry[]) => dispatch({ type: "LOAD_SUCCESS", chain }), []);
  const loadError     = useCallback(() => dispatch({ type: "LOAD_ERROR" }), []);
  const setMode       = useCallback((mode: StrategyMode) => dispatch({ type: "SET_MODE", mode }), []);
  const setSelectedDiff = useCallback((diff: number | null) => dispatch({ type: "SET_SELECTED_DIFF", diff }), []);
  const setDirection  = useCallback((direction: Direction) => dispatch({ type: "SET_DIRECTION", direction }), []);
  const executeStart  = useCallback((acting: ActionType) => dispatch({ type: "EXECUTE_START", acting }), []);
  const executeDone   = useCallback(() => dispatch({ type: "EXECUTE_DONE" }), []);

  return {
    ...state,
    startLoading,
    loadSuccess,
    loadError,
    setMode,
    setSelectedDiff,
    setDirection,
    executeStart,
    executeDone,
  };
}

