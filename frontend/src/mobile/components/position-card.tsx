import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import { exitPosition, placeMarketOrder } from '@/services/trading-api'
import { useOptionContractsStore, formatExpiryLabel } from '@/stores/option-contracts-store'
import { getLotSize } from '@/lib/lot-sizes'
import { BrokerBadge } from '@/components/ui/broker-badge'
import type { Position } from '@/types'

interface PositionCardProps {
  position: Position
  onRefresh: () => void
}

function formatPnl(value: number): string {
  const abs = Math.abs(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return value >= 0 ? `+₹${abs}` : `-₹${abs}`
}

export function PositionCard({ position: p, onRefresh }: PositionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [reducing, setReducing] = useState(false)
  const [reduceQty, setReduceQty] = useState('1')

  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey)
  const lookup = getByInstrumentKey(p.instrumentToken, p.tradingSymbol)

  // Symbol label
  let symbolLabel: string
  let instrumentType: 'CE' | 'PE' | null = null
  if (lookup) {
    const { index, contract } = lookup
    instrumentType = contract.instrumentType
    symbolLabel = `${index} ${contract.strikePrice} ${contract.instrumentType} ${formatExpiryLabel(contract.expiry)}`
  } else {
    symbolLabel = p.tradingSymbol
    if (p.tradingSymbol.endsWith('CE')) instrumentType = 'CE'
    else if (p.tradingSymbol.endsWith('PE')) instrumentType = 'PE'
  }

  // Qty in lots
  const lotSize = getLotSize(p.tradingSymbol)
  const absQty = Math.abs(p.quantity)
  const sign = p.quantity < 0 ? '-' : '+'
  const qtyDisplay =
    lotSize > 1
      ? `${sign}${absQty / lotSize} lots`
      : `${sign}${absQty} qty`

  const pnlValue = p.unrealised + p.realised
  const pnlColor = pnlValue >= 0 ? 'text-emerald-500' : 'text-rose-500'

  const typeColor =
    instrumentType === 'PE'
      ? 'bg-green-500/10 text-green-500 border-green-500/20'
      : instrumentType === 'CE'
      ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
      : 'bg-muted/40 text-muted-foreground border-border/40'

  async function handleExit() {
    setExiting(true)
    try {
      await exitPosition(p.instrumentToken, p.product, p.broker)
      toast.success('Position exited')
      onRefresh()
    } catch {
      toast.error('Failed to exit position')
    } finally {
      setExiting(false)
    }
  }

  async function handleReduce() {
    const lots = parseInt(reduceQty, 10)
    if (isNaN(lots) || lots <= 0) {
      toast.error('Enter a valid lot quantity')
      return
    }
    const qty = lots * lotSize
    const txn: 'Buy' | 'Sell' = p.quantity < 0 ? 'Buy' : 'Sell'
    setReducing(true)
    try {
      await placeMarketOrder(p.instrumentToken, qty, txn, p.product, p.broker, p.exchange)
      toast.success(`Reduce order placed (${lots} lot${lots > 1 ? 's' : ''})`)
      onRefresh()
    } catch {
      toast.error('Failed to place reduce order')
    } finally {
      setReducing(false)
    }
  }

  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 overflow-hidden">
      {/* Card header — always visible, tap to toggle */}
      <button
        type="button"
        className="w-full text-left px-3 py-2.5 flex items-center gap-2"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Symbol + badge row */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded border',
                typeColor,
              )}
            >
              {instrumentType ?? p.exchange}
            </span>
            <span className="text-xs font-medium truncate">{symbolLabel}</span>
            <BrokerBadge brokerId={p.broker} size={13} />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {qtyDisplay}
            </span>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              LTP{' '}
              {p.ltp.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {/* P&L */}
        <div className="flex flex-col items-end shrink-0">
          <span className={cn('text-sm font-semibold font-mono tabular-nums', pnlColor)}>
            {formatPnl(p.unrealised)}
          </span>
          {p.realised !== 0 && (
            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
              R {formatPnl(p.realised)}
            </span>
          )}
        </div>

        {/* Chevron */}
        <div className="text-muted-foreground ml-1 shrink-0">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-2 border-t border-border/40 pt-2">
          {/* Avg price row */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Avg price</span>
            <span className="font-mono tabular-nums">
              {p.averagePrice.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          {/* Exit button */}
          <Button
            variant="destructive"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={handleExit}
            disabled={exiting}
          >
            {exiting ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
            Exit Position
          </Button>

          {/* Reduce row */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Reduce</span>
            <Input
              type="number"
              min={1}
              value={reduceQty}
              onChange={(e) => setReduceQty(e.target.value)}
              className="h-7 text-xs w-16 font-mono tabular-nums px-2"
            />
            <span className="text-xs text-muted-foreground shrink-0">lots</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={handleReduce}
              disabled={reducing}
            >
              {reducing ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
              Reduce
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
