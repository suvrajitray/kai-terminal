import type { AutoEntryStrategyInput } from "@/hooks/use-auto-entry";

export type AutoEntryDraft = AutoEntryStrategyInput;
export type DraftFieldSetter = <K extends keyof AutoEntryDraft>(key: K, value: AutoEntryDraft[K]) => void;

