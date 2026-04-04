import { useEffect, useRef, useState, useCallback } from "react";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { fetchOptionChain } from "@/services/trading-api";
import { UNDERLYING_KEYS } from "@/lib/shift-config";
import type { Position } from "@/types";

export interface PortfolioGreeks {
  netDelta: number;
  thetaPerDay: number;
}

type GreeksMap = Map<string, { delta: number; theta: number }>;
type GroupMap  = Map<string, { underlyingKey: string; expiry: string }>;

// Re-fetch greeks every 60s — delta changes continuously as spot moves
const REFRESH_INTERVAL_MS = 60_000;

export function usePortfolioGreeks(positions: Position[]): PortfolioGreeks {
  const [greeksMap, setGreeksMap] = useState<GreeksMap>(new Map());
  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);

  // Holds the current set of (underlying, expiry) groups derived from open positions
  const groupsRef = useRef<GroupMap>(new Map());

  const fetchGroups = useCallback(async (groups: GroupMap) => {
    if (groups.size === 0) return;
    const entries = [...groups.values()];
    const results = await Promise.allSettled(
      entries.map(({ underlyingKey, expiry }) => fetchOptionChain(underlyingKey, expiry))
    );
    setGreeksMap((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status !== "fulfilled") continue;
        for (const entry of result.value) {
          for (const side of [entry.callOptions, entry.putOptions]) {
            if (!side?.instrumentKey || !side.optionGreeks) continue;
            const existing = next.get(side.instrumentKey);
            const next_ = { delta: side.optionGreeks.delta, theta: side.optionGreeks.theta };
            if (existing?.delta !== next_.delta || existing?.theta !== next_.theta) {
              next.set(side.instrumentKey, next_);
              changed = true;
            }
          }
        }
      }
      return changed ? next : prev;
    });
  }, []);

  // When positions change, rebuild group map. Fetch immediately only for new groups.
  useEffect(() => {
    const openPositions = positions.filter((p) => p.quantity !== 0);
    const nextGroups: GroupMap = new Map();

    for (const p of openPositions) {
      const lookup = getByInstrumentKey(p.instrumentToken, p.tradingSymbol);
      if (!lookup) continue;
      const { index, contract } = lookup;
      const underlyingKey = UNDERLYING_KEYS[index];
      if (!underlyingKey) continue;
      const key = `${underlyingKey}::${contract.expiry}`;
      nextGroups.set(key, { underlyingKey, expiry: contract.expiry });
    }

    // Only fetch immediately for groups that weren't already loaded
    const newGroups: GroupMap = new Map(
      [...nextGroups].filter(([k]) => !groupsRef.current.has(k))
    );
    groupsRef.current = nextGroups;

    if (newGroups.size > 0) {
      fetchGroups(newGroups);
    }
  }, [positions, getByInstrumentKey, fetchGroups]);

  // Periodic refresh — re-fetch all current groups every 60s
  useEffect(() => {
    const id = setInterval(() => fetchGroups(groupsRef.current), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchGroups]);

  // Aggregate greeks weighted by signed position quantity
  let netDelta = 0;
  let thetaPerDay = 0;

  for (const p of positions.filter((pos) => pos.quantity !== 0)) {
    const lookup = getByInstrumentKey(p.instrumentToken, p.tradingSymbol);
    if (!lookup) continue;
    const chainKey = lookup.contract.upstoxToken;
    if (!chainKey) continue;
    const g = greeksMap.get(chainKey);
    if (!g) continue;
    netDelta    += g.delta * p.quantity;
    thetaPerDay += g.theta * p.quantity;
  }

  return { netDelta, thetaPerDay };
}
