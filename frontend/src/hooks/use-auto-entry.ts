import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { createLogger } from "@/lib/logger";

const log = createLogger("AutoEntry");

export interface AutoEntryStrategy {
  id: number;
  brokerType: string;
  name: string;
  enabled: boolean;
  instrument: string;
  optionType: string;
  lots: number;
  entryAfterTime: string;
  noEntryAfterTime: string;
  tradingDays: string[];
  excludeExpiryDay: boolean;
  onlyExpiryDay: boolean;
  expiryOffset: number;
  strikeMode: string;
  strikeParam: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutoEntryStatus {
  strategyId: number;
  enteredToday: boolean;
  enteredAtUtc: string | null;
}

export type AutoEntryStrategyInput = Omit<AutoEntryStrategy, "id" | "createdAt" | "updatedAt">;

export function useAutoEntry() {
  const [strategies, setStrategies] = useState<AutoEntryStrategy[]>([]);
  const [statuses, setStatuses]     = useState<AutoEntryStatus[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stratsRes, statsRes] = await Promise.all([
        apiClient.get<AutoEntryStrategy[]>("/api/auto-entry"),
        apiClient.get<AutoEntryStatus[]>("/api/auto-entry/status"),
      ]);
      setStrategies(stratsRes.data);
      setStatuses(statsRes.data);
      log.debug("loaded", stratsRes.data.length, "strategies");
    } catch (err) {
      log.error("failed to load strategies", err);
      setError("Failed to load strategies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const create = useCallback(async (input: AutoEntryStrategyInput): Promise<AutoEntryStrategy> => {
    setSaving(true);
    try {
      const res = await apiClient.post<AutoEntryStrategy>("/api/auto-entry", input);
      await loadAll();
      return res.data;
    } finally {
      setSaving(false);
    }
  }, [loadAll]);

  const update = useCallback(async (id: number, input: AutoEntryStrategyInput): Promise<AutoEntryStrategy> => {
    setSaving(true);
    try {
      const res = await apiClient.put<AutoEntryStrategy>(`/api/auto-entry/${id}`, input);
      await loadAll();
      return res.data;
    } finally {
      setSaving(false);
    }
  }, [loadAll]);

  const remove = useCallback(async (id: number): Promise<void> => {
    setSaving(true);
    try {
      await apiClient.delete(`/api/auto-entry/${id}`);
      await loadAll();
    } finally {
      setSaving(false);
    }
  }, [loadAll]);

  const toggle = useCallback(async (strategy: AutoEntryStrategy): Promise<void> => {
    const newEnabled = !strategy.enabled;
    setStrategies(prev => prev.map(s => s.id === strategy.id ? { ...s, enabled: newEnabled } : s));
    try {
      await apiClient.put(`/api/auto-entry/${strategy.id}`, {
        brokerType: strategy.brokerType, name: strategy.name, enabled: newEnabled,
        instrument: strategy.instrument, optionType: strategy.optionType, lots: strategy.lots,
        entryAfterTime: strategy.entryAfterTime, noEntryAfterTime: strategy.noEntryAfterTime,
        tradingDays: strategy.tradingDays, excludeExpiryDay: strategy.excludeExpiryDay,
        onlyExpiryDay: strategy.onlyExpiryDay, expiryOffset: strategy.expiryOffset,
        strikeMode: strategy.strikeMode, strikeParam: strategy.strikeParam,
      });
    } catch (err) {
      log.error("failed to toggle strategy", err);
      setStrategies(prev => prev.map(s => s.id === strategy.id ? { ...s, enabled: strategy.enabled } : s));
      throw err;
    }
  }, []);

  const getStatus = useCallback((id: number): AutoEntryStatus | undefined =>
    statuses.find(s => s.strategyId === id),
  [statuses]);

  return { strategies, statuses, loading, saving, error, create, update, remove, toggle, getStatus, reload: loadAll };
}
