import { useCallback, useEffect, useReducer } from "react";
import { TrendingUp, Layers } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { type QtyMode } from "@/components/ui/qty-input";
import { getLotSize } from "@/lib/lot-sizes";
import { useBrokerStore } from "@/stores/broker-store";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { SharedControls } from "./shared-controls";
import { ByPriceContent } from "./by-price-content";
import { ByChainTab } from "./by-chain-tab";

interface Props {
  onTabChange?: (tab: string) => void;
}

interface TradeFormState {
  broker: "upstox" | "zerodha";
  underlying: string;
  expiry: string;
  qtyValue: string;
  qtyMode: QtyMode;
  product: "I" | "D";
  activeTab: string;
}

type TradeFormAction =
  | { type: "SET_BROKER"; broker: "upstox" | "zerodha" }
  | { type: "SET_UNDERLYING"; underlying: string }
  | { type: "SET_EXPIRY"; expiry: string }
  | { type: "SET_QTY_VALUE"; value: string }
  | { type: "SET_QTY_MODE"; mode: QtyMode; newValue: string }
  | { type: "SET_PRODUCT"; product: "I" | "D" }
  | { type: "SET_TAB"; tab: string };

function tradeFormReducer(state: TradeFormState, action: TradeFormAction): TradeFormState {
  switch (action.type) {
    case "SET_BROKER":     return { ...state, broker: action.broker };
    case "SET_UNDERLYING": return { ...state, underlying: action.underlying };
    case "SET_EXPIRY":     return { ...state, expiry: action.expiry };
    case "SET_QTY_VALUE":  return { ...state, qtyValue: action.value };
    case "SET_QTY_MODE":   return { ...state, qtyMode: action.mode, qtyValue: action.newValue };
    case "SET_PRODUCT":    return { ...state, product: action.product };
    case "SET_TAB":        return { ...state, activeTab: action.tab };
    default: return state;
  }
}

export function QuickTradeDialog({ onTabChange }: Props) {
  const isUpstoxAuthed  = useBrokerStore((s) => s.isAuthenticated("upstox"));
  const isZerodhaAuthed = useBrokerStore((s) => s.isAuthenticated("zerodha"));
  const bothConnected   = isUpstoxAuthed && isZerodhaAuthed;

  const [form, dispatch] = useReducer(tradeFormReducer, {
    broker:     isUpstoxAuthed ? "upstox" : "zerodha",
    underlying: "NIFTY",
    expiry:     "",
    qtyValue:   "",
    qtyMode:    "lot",
    product:    "I",
    activeTab:  "price",
  });
  const { broker, underlying, expiry, qtyValue, qtyMode, product, activeTab } = form;

  const getExpiries = useOptionContractsStore((s) => s.getExpiries);
  const expiries = getExpiries(underlying);

  useEffect(() => {
    dispatch({ type: "SET_EXPIRY", expiry: expiries[0] ?? "" });
  }, [underlying, expiries.length]);

  const lotSize  = getLotSize(underlying);
  const num      = parseInt(qtyValue, 10);
  const quantity = isNaN(num) || num <= 0 ? lotSize : qtyMode === "lot" ? num * lotSize : num;

  const toggleQtyMode = useCallback(() => {
    const cur = parseInt(qtyValue, 10);
    const next: QtyMode = qtyMode === "lot" ? "qty" : "lot";
    const newValue = !isNaN(cur) && cur > 0
      ? next === "qty" ? String(cur * lotSize) : String(Math.max(1, Math.round(cur / lotSize)))
      : qtyValue;
    dispatch({ type: "SET_QTY_MODE", mode: next, newValue });
  }, [qtyValue, qtyMode, lotSize]);

  const handleTabChange = useCallback((tab: string) => {
    dispatch({ type: "SET_TAB", tab });
    onTabChange?.(tab);
  }, [onTabChange]);

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="w-full mb-5">
        <TabsTrigger value="price" className="flex-1 gap-1.5">
          <TrendingUp className="size-3.5" />
          By Price
        </TabsTrigger>
        <TabsTrigger value="chain" className="flex-1 gap-1.5">
          <Layers className="size-3.5" />
          By Chain
        </TabsTrigger>
      </TabsList>

      {/* ── By Price ─────────────────────────────────────────────────── */}
      <TabsContent value="price" className="mt-0">
        <ByPriceContent
          broker={broker}
          bothConnected={bothConnected}
          underlying={underlying}
          expiry={expiry}
          expiries={expiries}
          product={product}
          quantity={quantity}
          qtyValue={qtyValue}
          qtyMode={qtyMode}
          lotSize={lotSize}
          onBrokerChange={(b) => dispatch({ type: "SET_BROKER", broker: b })}
          onUnderlyingChange={(u) => dispatch({ type: "SET_UNDERLYING", underlying: u })}
          onExpiryChange={(e) => dispatch({ type: "SET_EXPIRY", expiry: e })}
          onProductChange={(p) => dispatch({ type: "SET_PRODUCT", product: p })}
          onQtyChange={(v) => dispatch({ type: "SET_QTY_VALUE", value: v })}
          onToggleQtyMode={toggleQtyMode}
        />
      </TabsContent>

      {/* ── By Chain ─────────────────────────────────────────────────── */}
      <TabsContent value="chain" className="mt-0 space-y-4">
        <SharedControls
          broker={broker}
          bothConnected={bothConnected}
          underlying={underlying}
          expiry={expiry}
          expiries={expiries}
          product={product}
          onBrokerChange={(b) => dispatch({ type: "SET_BROKER", broker: b })}
          onUnderlyingChange={(u) => dispatch({ type: "SET_UNDERLYING", underlying: u })}
          onExpiryChange={(e) => dispatch({ type: "SET_EXPIRY", expiry: e })}
          onProductChange={(p) => dispatch({ type: "SET_PRODUCT", product: p })}
        />

        <ByChainTab
          broker={broker}
          underlying={underlying}
          expiry={expiry}
          product={product}
          quantity={quantity}
          isActive={activeTab === "chain"}
          qtyValue={qtyValue}
          qtyMode={qtyMode}
          lotSize={lotSize}
          onQtyChange={(v) => dispatch({ type: "SET_QTY_VALUE", value: v })}
          onToggleMode={toggleQtyMode}
        />
      </TabsContent>
    </Tabs>
  );
}
