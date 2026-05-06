import { forwardRef } from "react";
import type { OptionChainEntry } from "@/types";
import type { OrderIntent } from "@/components/panels/order-dialog";
import { OptionChainTable } from "./option-chain-table";

interface ChainScrollBodyProps {
  loading: boolean;
  rows: OptionChainEntry[];
  atmStrike: number;
  spotPrice: number;
  underlying: string;
  liveStrikeSet: Set<number>;
  hasMoreLow: boolean;
  hasMoreHigh: boolean;
  onLoadMoreLow: () => void;
  onLoadMoreHigh: () => void;
  onOrder: (intent: OrderIntent) => void;
}

export const ChainScrollBody = forwardRef<HTMLDivElement, ChainScrollBodyProps>(function ChainScrollBody({
  loading,
  rows,
  atmStrike,
  spotPrice,
  underlying,
  liveStrikeSet,
  hasMoreLow,
  hasMoreHigh,
  onLoadMoreLow,
  onLoadMoreHigh,
  onOrder,
}, scrollRef) {
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      {loading && rows.length === 0 ? (
        <PanelMessage>Loading…</PanelMessage>
      ) : rows.length === 0 ? (
        <PanelMessage>No data</PanelMessage>
      ) : (
        <>
          <LoadMoreBlock
            hasMore={hasMoreLow}
            emptyText="All lower strikes loaded"
            onLoadMore={onLoadMoreLow}
          />

          <OptionChainTable
            rows={rows}
            atmStrike={atmStrike}
            spotPrice={spotPrice}
            underlying={underlying}
            liveStrikeSet={liveStrikeSet}
            onOrder={onOrder}
          />

          <LoadMoreBlock
            hasMore={hasMoreHigh}
            emptyText="All higher strikes loaded"
            onLoadMore={onLoadMoreHigh}
            borderClassName="border-t"
          />
        </>
      )}
    </div>
  );
});

function PanelMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function LoadMoreBlock({
  hasMore,
  emptyText,
  borderClassName = "border-b",
  onLoadMore,
}: {
  hasMore: boolean;
  emptyText: string;
  borderClassName?: string;
  onLoadMore: () => void;
}) {
  return (
    <div className={`${borderClassName} border-border/30 px-3 py-2`}>
      {hasMore ? (
        <button
          onClick={onLoadMore}
          className="w-full rounded border border-border/40 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          Load 15 more strikes
        </button>
      ) : (
        <p className="text-center text-[10px] text-muted-foreground/50">
          {emptyText}
        </p>
      )}
    </div>
  );
}

