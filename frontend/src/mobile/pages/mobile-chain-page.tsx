import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOptionChain } from '@/components/panels/option-chain-panel/use-option-chain'
import type { OptionChainEntry } from '@/types'
import { MobileChainTable } from '@/mobile/components/mobile-chain-table'
import { MobileOrderSheet } from '@/mobile/components/mobile-order-sheet'

const UNDERLYINGS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX', 'BANKEX'] as const

const UNDERLYING_LABELS: Record<string, string> = {
  NIFTY:     'NIFTY',
  BANKNIFTY: 'BNF',
  FINNIFTY:  'FINNIFTY',
  SENSEX:    'SENSEX',
  BANKEX:    'BANKEX',
}

interface OrderSheetState {
  open: boolean
  strike: number
  instrumentType: 'CE' | 'PE'
  upstoxKey: string
  ltp: number
}

export function MobileChainPage() {
  const {
    underlying,
    setUnderlying,
    expiry,
    setExpiry,
    expiries,
    visibleRows,
    hasMoreLow,
    hasMoreHigh,
    loadMoreLow,
    loadMoreHigh,
    atmStrike,
    spotPrice,
    pcr,
    atmIv,
    loading,
  } = useOptionChain()

  const [orderSheet, setOrderSheet] = useState<OrderSheetState | null>(null)

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

  function formatSpot(n: number) {
    if (!n) return '—'
    return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Underlying chips */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto scrollbar-none border-b border-border/30 shrink-0">
        {UNDERLYINGS.map((u) => (
          <button
            key={u}
            onClick={() => setUnderlying(u)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              underlying === u
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border/40',
            )}
          >
            {UNDERLYING_LABELS[u] ?? u}
          </button>
        ))}
      </div>

      {/* Expiry chips */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto scrollbar-none border-b border-border/30 shrink-0">
        {expiries.length === 0 ? (
          <span className="text-xs text-muted-foreground py-0.5">Loading expiries…</span>
        ) : (
          expiries.map((e) => {
            const [, m, d] = e.split('-')
            const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
            const label = `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]}`
            return (
              <button
                key={e}
                onClick={() => setExpiry(e)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  expiry === e
                    ? 'bg-primary/90 text-primary-foreground'
                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border/40',
                )}
              >
                {label}
              </button>
            )
          })
        )}
      </div>

      {/* Chain table — scrollable middle */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <MobileChainTable
            rows={visibleRows}
            atmStrike={atmStrike}
            onSelectSide={handleSelectSide}
            hasMoreLow={hasMoreLow}
            hasMoreHigh={hasMoreHigh}
            onLoadMoreLow={loadMoreLow}
            onLoadMoreHigh={loadMoreHigh}
          />
        )}
      </div>

      {/* Footer bar */}
      <div className="shrink-0 border-t border-border/30 bg-muted/20 px-4 py-2 flex items-center justify-between gap-3 text-xs font-mono tabular-nums text-muted-foreground overflow-x-auto scrollbar-none">
        <span>
          Spot <span className="text-foreground font-medium">{formatSpot(spotPrice)}</span>
        </span>
        <span>
          ATM <span className="text-foreground font-medium">{atmStrike || '—'}</span>
        </span>
        {atmIv != null && (
          <span>
            IV <span className="text-foreground font-medium">{atmIv.toFixed(1)}%</span>
          </span>
        )}
        {pcr != null && (
          <span>
            PCR <span className="text-foreground font-medium">{pcr.toFixed(2)}</span>
          </span>
        )}
      </div>

      {/* Order sheet */}
      {orderSheet && (
        <MobileOrderSheet
          open={orderSheet.open}
          onOpenChange={(open) => {
            if (!open) setOrderSheet(null)
            else setOrderSheet((s) => s && { ...s, open })
          }}
          strike={orderSheet.strike}
          instrumentType={orderSheet.instrumentType}
          underlying={underlying}
          expiry={expiry}
          upstoxKey={orderSheet.upstoxKey}
          ltp={orderSheet.ltp}
        />
      )}
    </div>
  )
}
