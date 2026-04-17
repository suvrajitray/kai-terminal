import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { placeMarketOrder } from '@/services/trading-api'
import { useBrokerStore } from '@/stores/broker-store'
import { useOptionContractsStore } from '@/stores/option-contracts-store'
import { isBrokerTokenExpired } from '@/lib/token-utils'
import { getLotSize } from '@/lib/lot-sizes'

export interface MobileOrderSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  strike: number
  instrumentType: 'CE' | 'PE'
  underlying: string
  expiry: string
  upstoxKey: string
  ltp: number
}

const BROKERS = ['upstox', 'zerodha'] as const
type BrokerId = (typeof BROKERS)[number]

const BROKER_LABELS: Record<BrokerId, string> = {
  upstox: 'Upstox',
  zerodha: 'Zerodha',
}

export function MobileOrderSheet({
  open,
  onOpenChange,
  strike,
  instrumentType,
  underlying,
  expiry,
  upstoxKey,
  ltp,
}: MobileOrderSheetProps) {
  const getCredentials = useBrokerStore((s) => s.getCredentials)
  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey)

  // Determine available brokers
  const availableBrokers = BROKERS.filter((b) => {
    const creds = getCredentials(b)
    return creds?.accessToken && !isBrokerTokenExpired(b, creds.accessToken)
  })

  const [broker, setBroker] = useState<BrokerId>(() =>
    availableBrokers.includes('upstox') ? 'upstox' : availableBrokers[0] ?? 'upstox',
  )
  const [product, setProduct] = useState<'Intraday' | 'Delivery'>('Intraday')
  const [txn, setTxn] = useState<'Buy' | 'Sell'>('Sell')
  const [lots, setLots] = useState('1')
  const [loading, setLoading] = useState(false)

  const lotSize = getLotSize(underlying)
  const lotCount = Math.max(1, parseInt(lots, 10) || 1)
  const qty = lotCount * lotSize

  const exchange = upstoxKey.startsWith('BSE_') ? 'BFO' : 'NFO'

  function resolveToken(): string | null {
    if (broker === 'upstox') return upstoxKey
    const lookup = getByInstrumentKey(upstoxKey)
    return lookup?.contract.zerodhaToken ?? null
  }

  async function handlePlaceOrder() {
    const token = resolveToken()
    if (!token) {
      toast.error(`No ${BROKER_LABELS[broker]} instrument token found`)
      return
    }

    const productCode = product === 'Intraday' ? (broker === 'zerodha' ? 'MIS' : 'I') : (broker === 'zerodha' ? 'NRML' : 'D')

    setLoading(true)
    try {
      await placeMarketOrder(token, qty, txn, productCode, broker, exchange)
      toast.success(`${txn} ${lotCount} lot${lotCount > 1 ? 's' : ''} ${underlying} ${strike} ${instrumentType}`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Order failed')
    } finally {
      setLoading(false)
    }
  }

  const expiryDisplay = expiry
    ? (() => {
        const [y, m, d] = expiry.split('-')
        const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
        return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y.slice(2)}`
      })()
    : expiry

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-8 pt-4 max-h-[85vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center justify-between">
            <span className="font-mono text-base">
              {underlying} {strike}{' '}
              <span className={instrumentType === 'CE' ? 'text-rose-500' : 'text-green-500'}>
                {instrumentType}
              </span>
              <span className="text-muted-foreground text-xs ml-2">{expiryDisplay}</span>
            </span>
            {ltp > 0 && (
              <span className="text-sm font-mono tabular-nums text-foreground">
                LTP <span className="font-semibold">{ltp.toFixed(2)}</span>
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Broker */}
          {availableBrokers.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Broker</Label>
              <div className="flex gap-2">
                {availableBrokers.map((b) => (
                  <button
                    key={b}
                    onClick={() => setBroker(b)}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      broker === b
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40',
                    )}
                  >
                    {BROKER_LABELS[b]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Buy / Sell */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Side</Label>
            <div className="flex gap-2">
              {(['Sell', 'Buy'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTxn(t)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                    txn === t
                      ? t === 'Sell'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-400'
                        : 'border-green-500 bg-green-500/10 text-green-400'
                      : 'border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Product */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Product</Label>
            <div className="flex gap-2">
              {(['Intraday', 'Delivery'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setProduct(p)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    product === p
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Qty */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Lots{' '}
              <span className="normal-case text-muted-foreground/70">
                (1 lot = {lotSize} qty · total {qty})
              </span>
            </Label>
            <Input
              type="number"
              min={1}
              value={lots}
              onChange={(e) => setLots(e.target.value)}
              className="text-center font-mono text-base tabular-nums"
            />
          </div>

          {/* Place Order */}
          <Button
            className={cn(
              'w-full h-12 text-base font-semibold',
              txn === 'Sell'
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white',
            )}
            disabled={loading || availableBrokers.length === 0}
            onClick={handlePlaceOrder}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {loading
              ? 'Placing…'
              : availableBrokers.length === 0
              ? 'No broker connected'
              : `${txn} ${lotCount} lot${lotCount > 1 ? 's' : ''} · ${qty} qty`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
