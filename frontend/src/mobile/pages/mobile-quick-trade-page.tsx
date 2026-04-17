import { useEffect, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useQuickTradeForm } from '@/components/layout/quick-trade-dialog/use-quick-trade-form'
import { ByPriceContent } from '@/components/layout/quick-trade-dialog/by-price-content'
import { SharedControls } from '@/components/layout/quick-trade-dialog/shared-controls'
import { useOptionChain } from '@/components/panels/option-chain-panel/use-option-chain'
import { MobileChainTable } from '@/mobile/components/mobile-chain-table'
import { MobileOrderSheet } from '@/mobile/components/mobile-order-sheet'
import type { OptionChainEntry } from '@/types'

export function MobileQuickTradePage() {
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
  } = useQuickTradeForm()

  // By Chain: use the option chain hook, sync with form underlying/expiry
  const chain = useOptionChain()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (form.underlying !== chain.underlying) chain.setUnderlying(form.underlying)
  }, [form.underlying])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (form.expiry && form.expiry !== chain.expiry) chain.setExpiry(form.expiry)
  }, [form.expiry])

  // Order sheet state (for By Chain tab)
  const [orderSheet, setOrderSheet] = useState<{
    open: boolean
    strike: number
    instrumentType: 'CE' | 'PE'
    upstoxKey: string
    ltp: number
  } | null>(null)

  function handleSelectSide(entry: OptionChainEntry, side: 'CE' | 'PE') {
    const optSide = side === 'CE' ? entry.callOptions : entry.putOptions
    if (!optSide) return
    setOrderSheet({
      open: true,
      strike: entry.strikePrice,
      instrumentType: side,
      upstoxKey: optSide.instrumentKey,
      ltp: optSide.marketData?.ltp ?? 0,
    })
  }

  return (
    <div className="flex flex-col min-h-full">
      <Tabs
        value={form.activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1"
      >
        <div className="px-4 pt-4 pb-0">
          <TabsList className="w-full">
            <TabsTrigger value="price" className="flex-1">By Price</TabsTrigger>
            <TabsTrigger value="chain" className="flex-1">By Chain</TabsTrigger>
          </TabsList>
        </div>

        {/* By Price: ByPriceContent already includes SharedControls */}
        <TabsContent value="price" className="flex-1 px-4 py-4">
          <ByPriceContent
            broker={form.broker}
            bothConnected={bothConnected}
            underlying={form.underlying}
            expiry={form.expiry}
            expiries={expiries}
            product={form.product}
            quantity={quantity}
            qtyValue={form.qtyValue}
            qtyMode={form.qtyMode}
            lotSize={lotSize}
            onBrokerChange={setBroker}
            onUnderlyingChange={setUnderlying}
            onExpiryChange={setExpiry}
            onProductChange={setProduct}
            onQtyChange={setQtyValue}
            onToggleQtyMode={toggleQtyMode}
          />
        </TabsContent>

        {/* By Chain: SharedControls (broker/underlying/expiry/product) + chain table */}
        <TabsContent value="chain" className="flex flex-col flex-1">
          <div className="px-4 py-4">
            <SharedControls
              broker={form.broker}
              bothConnected={bothConnected}
              underlying={form.underlying}
              expiry={form.expiry}
              expiries={expiries}
              product={form.product}
              onBrokerChange={setBroker}
              onUnderlyingChange={setUnderlying}
              onExpiryChange={setExpiry}
              onProductChange={setProduct}
            />
          </div>
          {chain.loading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Loading chain...
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <MobileChainTable
                rows={chain.visibleRows}
                atmStrike={chain.atmStrike}
                onSelectSide={handleSelectSide}
                hasMoreLow={chain.hasMoreLow}
                hasMoreHigh={chain.hasMoreHigh}
                onLoadMoreLow={chain.loadMoreLow}
                onLoadMoreHigh={chain.loadMoreHigh}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Order sheet */}
      {orderSheet && (
        <MobileOrderSheet
          open={orderSheet.open}
          onOpenChange={(open) => {
            if (!open) setOrderSheet(null)
            else setOrderSheet((s) => (s ? { ...s, open } : null))
          }}
          strike={orderSheet.strike}
          instrumentType={orderSheet.instrumentType}
          underlying={form.underlying}
          expiry={form.expiry}
          upstoxKey={orderSheet.upstoxKey}
          ltp={orderSheet.ltp}
        />
      )}
    </div>
  )
}
