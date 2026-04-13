import { useCallback, useEffect, useState } from "react";
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

export function QuickTradeDialog({ onTabChange }: Props) {
  const isUpstoxAuthed  = useBrokerStore((s) => s.isAuthenticated("upstox"));
  const isZerodhaAuthed = useBrokerStore((s) => s.isAuthenticated("zerodha"));
  const bothConnected   = isUpstoxAuthed && isZerodhaAuthed;

  const [broker, setBroker]         = useState<"upstox" | "zerodha">(() =>
    isUpstoxAuthed ? "upstox" : "zerodha",
  );
  const [underlying, setUnderlying] = useState("NIFTY");
  const [expiry, setExpiry]         = useState("");
  const [qtyValue, setQtyValue]     = useState("");
  const [qtyMode, setQtyMode]       = useState<QtyMode>("lot");
  const [product, setProduct]       = useState<"I" | "D">("I");
  const [activeTab, setActiveTab]   = useState("price");

  const getExpiries = useOptionContractsStore((s) => s.getExpiries);
  const expiries = getExpiries(underlying);

  useEffect(() => {
    setExpiry(expiries[0] ?? "");
  }, [underlying, expiries.length]);

  const lotSize  = getLotSize(underlying);
  const num      = parseInt(qtyValue, 10);
  const quantity = isNaN(num) || num <= 0 ? lotSize : qtyMode === "lot" ? num * lotSize : num;

  const toggleQtyMode = useCallback(() => {
    setQtyMode((prev) => {
      const next: QtyMode = prev === "lot" ? "qty" : "lot";
      const cur = parseInt(qtyValue, 10);
      if (!isNaN(cur) && cur > 0) {
        setQtyValue(
          next === "qty" ? String(cur * lotSize) : String(Math.max(1, Math.round(cur / lotSize))),
        );
      }
      return next;
    });
  }, [qtyValue, lotSize]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  }, [onTabChange]);

  const sharedControls = (
    <SharedControls
      broker={broker}
      bothConnected={bothConnected}
      underlying={underlying}
      expiry={expiry}
      expiries={expiries}
      product={product}
      onBrokerChange={setBroker}
      onUnderlyingChange={setUnderlying}
      onExpiryChange={setExpiry}
      onProductChange={setProduct}
    />
  );

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
          underlying={underlying}
          expiry={expiry}
          product={product}
          quantity={quantity}
          qtyValue={qtyValue}
          qtyMode={qtyMode}
          lotSize={lotSize}
          onQtyChange={setQtyValue}
          onToggleQtyMode={toggleQtyMode}
          sharedControls={sharedControls}
        />
      </TabsContent>

      {/* ── By Chain ─────────────────────────────────────────────────── */}
      <TabsContent value="chain" className="mt-0 space-y-4">
        {sharedControls}

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
          onQtyChange={setQtyValue}
          onToggleMode={toggleQtyMode}
        />
      </TabsContent>
    </Tabs>
  );
}
