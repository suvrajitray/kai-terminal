import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarketStatus } from '@/components/layout/market-status'
import { useMobileMtmStore } from '@/mobile/mobile-mtm-store'
import { performLogout } from '@/lib/logout'

export function MobileHeader() {
  const totalMtm = useMobileMtmStore((s) => s.totalMtm)
  const mtmLabel = totalMtm == null
    ? null
    : (totalMtm >= 0 ? '+' : '') + totalMtm.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const mtmColor = totalMtm == null ? '' : totalMtm >= 0 ? 'text-green-500' : 'text-red-500'

  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-border/40 bg-background px-4">
      <span className="font-mono text-sm font-bold tracking-wider text-foreground">KAI</span>
      {mtmLabel && (
        <span className={cn('font-mono text-xs font-semibold tabular-nums', mtmColor)}>
          {mtmLabel}
        </span>
      )}
      <div className="flex items-center gap-3">
        <MarketStatus />
        <button
          onClick={performLogout}
          className="flex items-center justify-center text-muted-foreground active:text-foreground"
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
