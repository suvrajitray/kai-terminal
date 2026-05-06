import { Activity, Crosshair, IndianRupee, TrendingUp } from "lucide-react";

export const OPTION_TYPES = [
  { id: "CE", label: "CE" },
  { id: "PE", label: "PE" },
  { id: "CE+PE", label: "CE + PE" },
] as const;

export const TRADING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

export const STRIKE_MODES = [
  { id: "ATM", label: "ATM", sub: "At-the-money strike", Icon: Crosshair },
  { id: "OTM", label: "OTM", sub: "Out-of-the-money strike", Icon: TrendingUp },
  { id: "Delta", label: "Delta", sub: "Select by target delta", Icon: Activity },
  { id: "Premium", label: "Premium", sub: "Select by option premium", Icon: IndianRupee },
] as const;

