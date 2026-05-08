import { useEffect, useMemo, useRef, useState } from "react";
import { UNDERLYING_KEYS } from "@/lib/shift-config";
import { OrderDialog, type OrderIntent } from "@/components/panels/order-dialog";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { ChainScrollBody } from "./chain-scroll-body";
import { calculateHedgeSuggestion } from "./hedge-suggestion";
import { OptionChainFooter } from "./option-chain-footer";
import { PanelHeader } from "./panel-header";
import { PanelResizeHandle } from "./panel-resize-handle";
import { useOptionChain } from "./use-option-chain";

interface Props {
  width: number;
  onResize?: (width: number) => void;
  onClose?: () => void;
  netDelta?: number;
}

export function OptionChainPanel({ width, onResize, onClose, netDelta }: Props) {
  const {
    underlying,
    setUnderlying,
    expiry,
    setExpiry,
    expiries,
    allChain,
    visibleRows,
    hasMoreLow,
    hasMoreHigh,
    loadMoreLow,
    loadMoreHigh,
    liveStrikeSet,
    atmStrike,
    spotPrice,
    pcr,
    atmIv,
    maxPain,
    expectedMovePct,
    expectedMovePts,
    ivRank,
    ivPercentile,
    ivHistoryDays,
    loading,
    refresh,
    scrollSignal,
  } = useOptionChain();

  const [orderIntent, setOrderIntent] = useState<OrderIntent | null>(null);
  const [basketMode, setBasketMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const underlyings = Object.keys(UNDERLYING_KEYS);

  const getContracts = useOptionContractsStore((state) => state.getContracts);
  const lotSize = getContracts(underlying)[0]?.lotSize ?? 75;
  const hedgeSuggestion = useMemo(
    () => calculateHedgeSuggestion({ netDelta, atmStrike, visibleRows, lotSize }),
    [atmStrike, lotSize, netDelta, visibleRows],
  );
  const currentLtp = useMemo(
    () => getCurrentOrderLtp(allChain, orderIntent),
    [allChain, orderIntent],
  );

  useEffect(() => {
    if (scrollSignal === 0 || atmStrike === 0) return;

    const container = scrollRef.current;
    if (!container) return;

    const id = requestAnimationFrame(() => {
      const atm = container.querySelector<HTMLElement>('[data-atm="true"]');
      if (!atm) return;
      container.scrollTop = atm.offsetTop - container.clientHeight / 2 + atm.offsetHeight / 2;
    });

    return () => cancelAnimationFrame(id);
  }, [atmStrike, scrollSignal]);

  return (
    <>
      <div
        className="relative flex shrink-0 flex-col overflow-hidden border-l border-border bg-background"
        style={{ width }}
      >
        <PanelResizeHandle width={width} onResize={onResize} />
        <PanelHeader
          underlying={underlying}
          underlyings={underlyings}
          expiry={expiry}
          expiries={expiries}
          loading={loading}
          onUnderlyingChange={setUnderlying}
          onExpiryChange={setExpiry}
          onRefresh={refresh}
          onClose={onClose}
          basketMode={basketMode}
          onBasketModeToggle={() => setBasketMode((b) => !b)}
        />
        <ChainScrollBody
          ref={scrollRef}
          loading={loading}
          rows={visibleRows}
          atmStrike={atmStrike}
          spotPrice={spotPrice}
          underlying={underlying}
          liveStrikeSet={liveStrikeSet}
          hasMoreLow={hasMoreLow}
          hasMoreHigh={hasMoreHigh}
          onLoadMoreLow={loadMoreLow}
          onLoadMoreHigh={loadMoreHigh}
          onOrder={setOrderIntent}
          basketMode={basketMode}
        />
        <OptionChainFooter
          underlying={underlying}
          spotPrice={spotPrice}
          atmStrike={atmStrike}
          atmIv={atmIv}
          pcr={pcr}
          ivRank={ivRank}
          ivPercentile={ivPercentile}
          ivHistoryDays={ivHistoryDays}
          expectedMovePct={expectedMovePct}
          expectedMovePts={expectedMovePts}
          maxPain={maxPain}
          netDelta={netDelta}
          hedgeSuggestion={hedgeSuggestion}
        />
      </div>

      <OrderDialog
        intent={orderIntent}
        currentLtp={currentLtp}
        onClose={() => setOrderIntent(null)}
      />
    </>
  );
}

function getCurrentOrderLtp(
  chain: ReturnType<typeof useOptionChain>["allChain"],
  intent: OrderIntent | null,
) {
  if (!intent) return undefined;

  for (const entry of chain) {
    if (entry.callOptions?.instrumentKey === intent.instrumentKey) {
      return entry.callOptions.marketData?.ltp;
    }
    if (entry.putOptions?.instrumentKey === intent.instrumentKey) {
      return entry.putOptions.marketData?.ltp;
    }
  }

  return undefined;
}

