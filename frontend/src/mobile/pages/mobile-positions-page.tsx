import { useState, useCallback } from 'react'
import { LayoutList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { exitAllPositions, exitAllZerodhaPositions } from '@/services/trading-api'
import { useSignalrPositions } from '@/components/panels/positions-panel/use-signalr-positions'
import { usePortfolioGreeks } from '@/hooks/use-portfolio-greeks'
import { useMobileMtmStore } from '@/mobile/mobile-mtm-store'
import { PositionCard } from '@/mobile/components/position-card'
import type { Position } from '@/types'

type BrokerFilter = 'all' | 'upstox' | 'zerodha'

function formatMtm(value: number): string {
  const abs = Math.abs(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return value >= 0 ? `+₹${abs}` : `-₹${abs}`
}

function formatGreek(value: number, decimals = 2): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: 'always',
  })
}

export function MobilePositionsPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [brokerFilter, setBrokerFilter] = useState<BrokerFilter>('all')
  const [exiting, setExiting] = useState(false)

  const setTotalMtm = useMobileMtmStore((s) => s.setTotalMtm)

  const onPositions = useCallback(
    (incoming: Position[]) => {
      setPositions(incoming)
      const total = incoming.reduce((sum, p) => sum + p.unrealised + p.realised, 0)
      setTotalMtm(total)
    },
    [setTotalMtm],
  )

  const onLtpBatch = useCallback(
    (updates: Array<{ instrumentToken: string; ltp: number }>) => {
      setPositions((prev) => {
        const next = prev.map((p) => {
          const u = updates.find((x) => x.instrumentToken === p.instrumentToken)
          if (!u) return p
          const ltp = u.ltp
          const unrealised = (ltp - p.averagePrice) * p.quantity
          return { ...p, ltp, unrealised }
        })
        const total = next.reduce((sum, p) => sum + p.unrealised + p.realised, 0)
        setTotalMtm(total)
        return next
      })
    },
    [setTotalMtm],
  )

  const onFallbackLoad = useCallback(async () => {
    // useSignalrPositions handles the connection; nothing to do here
  }, [])

  useSignalrPositions({
    onPositions,
    onLtpBatch,
    onFallbackLoad,
    setLoading,
  })

  const greeks = usePortfolioGreeks(positions)

  const openPositions = positions.filter((p) => p.isOpen && p.quantity !== 0)
  const closedPositions = positions.filter((p) => !p.isOpen || p.quantity === 0)

  // Determine which brokers have open positions
  const brokersWithPositions = [...new Set(openPositions.map((p) => p.broker))] as ('upstox' | 'zerodha')[]

  const filteredOpen =
    brokerFilter === 'all'
      ? openPositions
      : openPositions.filter((p) => p.broker === brokerFilter)

  const filteredClosed =
    brokerFilter === 'all'
      ? closedPositions
      : closedPositions.filter((p) => p.broker === brokerFilter)

  const totalMtm = openPositions.reduce((sum, p) => sum + p.unrealised + p.realised, 0)
  const mtmColor = totalMtm >= 0 ? 'text-emerald-500' : 'text-rose-500'

  async function handleExitAll() {
    setExiting(true)
    try {
      const calls: Promise<void>[] = []
      if (brokersWithPositions.includes('upstox')) calls.push(exitAllPositions())
      if (brokersWithPositions.includes('zerodha')) calls.push(exitAllZerodhaPositions())
      await Promise.all(calls)
      toast.success('Exit all orders placed')
    } catch {
      toast.error('Failed to exit all positions')
    } finally {
      setExiting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top stats bar */}
      <div className="px-3 pt-3 pb-2 border-b border-border/40 bg-background/80">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
              Total MTM
            </span>
            <span className={cn('text-xl font-bold font-mono tabular-nums', mtmColor)}>
              {formatMtm(totalMtm)}
            </span>
          </div>

          {/* Greeks chips + Exit All */}
          <div className="flex items-center gap-1.5">
            <div className="flex flex-col items-center px-2 py-1 rounded bg-muted/30 border border-border/40">
              <span className="text-[9px] text-muted-foreground uppercase">Δ Delta</span>
              <span className="text-xs font-mono tabular-nums">{formatGreek(greeks.netDelta)}</span>
            </div>
            <div className="flex flex-col items-center px-2 py-1 rounded bg-muted/30 border border-border/40">
              <span className="text-[9px] text-muted-foreground uppercase">Θ Theta</span>
              <span className="text-xs font-mono tabular-nums">{formatGreek(greeks.thetaPerDay, 0)}</span>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs px-2.5"
                  disabled={exiting || openPositions.length === 0}
                >
                  Exit All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Exit All Positions?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will place market exit orders for all {openPositions.length} open{' '}
                    {openPositions.length === 1 ? 'position' : 'positions'}. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    size="sm"
                    onClick={handleExitAll}
                  >
                    Exit All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Broker filter chips */}
        {brokersWithPositions.length > 1 && (
          <div className="flex items-center gap-1.5 mt-2">
            {(['all', ...brokersWithPositions] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBrokerFilter(b as BrokerFilter)}
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-xs border transition-colors',
                  brokerFilter === b
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/30 text-muted-foreground border-border/40',
                )}
              >
                {b === 'all' ? 'All' : b.charAt(0).toUpperCase() + b.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs + position list */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="open" className="h-full flex flex-col">
          <TabsList className="mx-3 mt-2 mb-0 h-8 shrink-0">
            <TabsTrigger value="open" className="text-xs flex-1">
              Open
              {openPositions.length > 0 && (
                <span className="ml-1 text-[10px] opacity-60">({openPositions.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="closed" className="text-xs flex-1">
              Closed
              {closedPositions.length > 0 && (
                <span className="ml-1 text-[10px] opacity-60">({closedPositions.length})</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="flex-1 overflow-y-auto mt-2 px-3 pb-4">
            {loading ? (
              <SkeletonCards />
            ) : filteredOpen.length === 0 ? (
              <EmptyState label="No open positions" />
            ) : (
              <div className="flex flex-col gap-2">
                {filteredOpen.map((p) => (
                  <PositionCard
                    key={`${p.broker}-${p.instrumentToken}`}
                    position={p}
                    onRefresh={() => {/* SignalR will push updates */}}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="closed" className="flex-1 overflow-y-auto mt-2 px-3 pb-4">
            {loading ? (
              <SkeletonCards />
            ) : filteredClosed.length === 0 ? (
              <EmptyState label="No closed positions" />
            ) : (
              <div className="flex flex-col gap-2">
                {filteredClosed.map((p) => (
                  <PositionCard
                    key={`${p.broker}-${p.instrumentToken}-closed`}
                    position={p}
                    onRefresh={() => {}}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <LayoutList size={32} className="opacity-30" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
