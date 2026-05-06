import type { AutoEntryStrategy, AutoEntryStrategyInput } from "@/hooks/use-auto-entry";

export function makeDefaultStrategy(brokerType: string): AutoEntryStrategyInput {
  return {
    brokerType,
    name: "Morning Sell",
    enabled: true,
    instrument: "NIFTY",
    optionType: "CE+PE",
    lots: 1,
    entryAfterTime: "09:15",
    noEntryAfterTime: "12:15",
    tradingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    excludeExpiryDay: false,
    onlyExpiryDay: false,
    expiryOffset: 0,
    strikeMode: "Delta",
    strikeParam: 0.25,
  };
}

export function strategyToInput(strategy: AutoEntryStrategy): AutoEntryStrategyInput {
  return {
    brokerType: strategy.brokerType,
    name: strategy.name,
    enabled: strategy.enabled,
    instrument: strategy.instrument,
    optionType: strategy.optionType,
    lots: strategy.lots,
    entryAfterTime: strategy.entryAfterTime,
    noEntryAfterTime: strategy.noEntryAfterTime,
    tradingDays: strategy.tradingDays,
    excludeExpiryDay: strategy.excludeExpiryDay,
    onlyExpiryDay: strategy.onlyExpiryDay,
    expiryOffset: strategy.expiryOffset,
    strikeMode: strategy.strikeMode,
    strikeParam: strategy.strikeParam,
  };
}

export function fmt12h(time: string) {
  const [hours = "0", minutes = "00"] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function strikeParamLabel(mode: string) {
  if (mode === "OTM") return "Strikes from ATM";
  if (mode === "Delta") return "Delta Value";
  return "Target Premium (₹)";
}

export function describeStrike(mode: string, param: number) {
  if (mode === "ATM") return "ATM";
  if (mode === "OTM") return `OTM +${param}`;
  if (mode === "Delta") return `Delta ${param.toFixed(2)}`;
  return `₹${param}`;
}

