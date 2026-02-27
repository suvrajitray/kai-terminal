import type { BrokerInfo } from "@/types";

export const APP_NAME = "KAI Terminal";

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "https://localhost:5001";

export const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Connect Brokers", path: "/connect-brokers" },
] as const;

export const BROKERS: BrokerInfo[] = [
  {
    id: "zerodha",
    name: "Zerodha",
    description:
      "India's largest retail stockbroker. Trade in equities, commodities, futures & options via Kite Connect API.",
    color: "#387ED1",
    features: ["Equities", "F&O", "Commodities", "WebSocket"],
    connected: false,
  },
  {
    id: "upstox",
    name: "Upstox",
    description:
      "Next-gen trading platform with powerful APIs for equities and derivatives trading.",
    color: "#7B2FF7",
    features: ["Equities", "F&O", "REST API", "WebSocket"],
    connected: false,
  },
  {
    id: "dhan",
    name: "Dhan",
    description:
      "Built for super traders and investors. Lightning-fast order execution with developer-friendly APIs.",
    color: "#00B386",
    features: ["Equities", "F&O", "Options Chain", "WebSocket"],
    connected: false,
  },
];
