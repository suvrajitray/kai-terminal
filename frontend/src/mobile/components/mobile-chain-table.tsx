import { cn } from '@/lib/utils'
import type { OptionChainEntry } from '@/types'

export interface MobileChainTableProps {
  rows: OptionChainEntry[]
  atmStrike: number
  onSelectSide: (entry: OptionChainEntry, side: 'CE' | 'PE') => void
  hasMoreLow: boolean
  hasMoreHigh: boolean
  onLoadMoreLow: () => void
  onLoadMoreHigh: () => void
}

function formatLtp(ltp: number | undefined): string {
  if (ltp == null || ltp === 0) return '—'
  return ltp.toFixed(2)
}

export function MobileChainTable({
  rows,
  atmStrike,
  onSelectSide,
  hasMoreLow,
  hasMoreHigh,
  onLoadMoreLow,
  onLoadMoreHigh,
}: MobileChainTableProps) {
  return (
    <div className="flex flex-col w-full text-sm font-mono select-none">
      {/* Header */}
      <div className="grid grid-cols-3 border-b border-border/40 bg-muted/20 py-1.5 px-2 text-xs text-muted-foreground sticky top-0 z-10">
        <span className="text-right text-rose-400/70">CE</span>
        <span className="text-center">Strike</span>
        <span className="text-left text-green-400/70">PE</span>
      </div>

      {/* Load more (lower strikes = earlier in array after sort high-to-low, or top) */}
      {hasMoreHigh && (
        <button
          onClick={onLoadMoreHigh}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors border-b border-border/20"
        >
          ↑ Load more
        </button>
      )}

      {/* Rows */}
      {rows.map((entry) => {
        const isAtm = entry.strikePrice === atmStrike
        const ceLtp = entry.callOptions?.marketData?.ltp
        const peLtp = entry.putOptions?.marketData?.ltp

        return (
          <div
            key={entry.strikePrice}
            className={cn(
              'grid grid-cols-3 border-b border-border/20',
              isAtm && 'bg-muted/30',
            )}
          >
            {/* CE cell */}
            <button
              className={cn(
                'text-right py-3 px-3 tabular-nums text-rose-500 active:bg-rose-500/10 transition-colors',
                !entry.callOptions && 'opacity-30 pointer-events-none',
              )}
              onClick={() => entry.callOptions && onSelectSide(entry, 'CE')}
              disabled={!entry.callOptions}
            >
              {formatLtp(ceLtp)}
            </button>

            {/* Strike */}
            <div
              className={cn(
                'flex items-center justify-center py-3 px-1',
                isAtm
                  ? 'font-bold text-foreground text-base'
                  : 'text-muted-foreground text-sm',
              )}
            >
              {entry.strikePrice}
            </div>

            {/* PE cell */}
            <button
              className={cn(
                'text-left py-3 px-3 tabular-nums text-green-500 active:bg-green-500/10 transition-colors',
                !entry.putOptions && 'opacity-30 pointer-events-none',
              )}
              onClick={() => entry.putOptions && onSelectSide(entry, 'PE')}
              disabled={!entry.putOptions}
            >
              {formatLtp(peLtp)}
            </button>
          </div>
        )
      })}

      {/* Load more (higher strikes = bottom) */}
      {hasMoreLow && (
        <button
          onClick={onLoadMoreLow}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors border-t border-border/20"
        >
          ↓ Load more
        </button>
      )}
    </div>
  )
}
