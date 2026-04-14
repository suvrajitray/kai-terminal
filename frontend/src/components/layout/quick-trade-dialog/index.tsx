import { useCallback } from "react";
import { TrendingUp, Layers } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SharedControls } from "./shared-controls";
import { ByPriceContent } from "./by-price-content";
import { ByChainTab } from "./by-chain-tab";
import { useQuickTradeForm } from "./use-quick-trade-form";

interface Props {
  onTabChange?: (tab: string) => void;
}

export function QuickTradeDialog({ onTabChange }: Props) {
  const {
    bothConnected,
    expiries,
    lotSize,
    quantity,
    form,
    setBroker,
    setUnderlying,
    setExpiry,
    setQtyValue,
    setProduct,
    setActiveTab,
    toggleQtyMode,
  } = useQuickTradeForm();
  const { broker, underlying, expiry, qtyValue, qtyMode, product, activeTab } = form;

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  }, [onTabChange, setActiveTab]);

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
          onBrokerChange={setBroker}
          onUnderlyingChange={setUnderlying}
          onExpiryChange={setExpiry}
          onProductChange={setProduct}
          onQtyChange={setQtyValue}
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
          onBrokerChange={setBroker}
          onUnderlyingChange={setUnderlying}
          onExpiryChange={setExpiry}
          onProductChange={setProduct}
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
          onQtyChange={setQtyValue}
          onToggleMode={toggleQtyMode}
        />
      </TabsContent>
    </Tabs>
  );
}
