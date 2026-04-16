import { createContext, useContext, ReactNode } from 'react';
import { useLivePositions, LivePosition } from './use-live-positions';

interface LivePositionsContextValue {
  positions: LivePosition[];
  connected: boolean;
}

const LivePositionsContext = createContext<LivePositionsContextValue>({
  positions: [],
  connected: false,
});

export function LivePositionsProvider({ children }: { children: ReactNode }) {
  const value = useLivePositions();
  return (
    <LivePositionsContext.Provider value={value}>
      {children}
    </LivePositionsContext.Provider>
  );
}

export function useLivePositionsContext(): LivePositionsContextValue {
  return useContext(LivePositionsContext);
}
