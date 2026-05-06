import { useCallback, useState } from "react";
import type { AutoEntryStrategyInput } from "@/hooks/use-auto-entry";
import { makeDefaultStrategy } from "./utils";

export function useAutoEntryDraft({
  brokerType,
  initialDraft,
}: {
  brokerType: string;
  initialDraft?: AutoEntryStrategyInput;
}) {
  const [draft, setDraft] = useState<AutoEntryStrategyInput>(() => initialDraft ?? makeDefaultStrategy(brokerType));

  const setField = useCallback(<K extends keyof AutoEntryStrategyInput>(
    key: K,
    value: AutoEntryStrategyInput[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setDraft(makeDefaultStrategy(brokerType));
  }, [brokerType]);

  return { draft, setField, reset };
}
