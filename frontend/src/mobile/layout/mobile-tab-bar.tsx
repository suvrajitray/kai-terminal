import { NavLink } from 'react-router-dom'
import { LayoutList, BarChart2, Zap, Shield, Building2, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/m/positions', label: 'Positions', Icon: LayoutList },
  { to: '/m/chain',     label: 'Chain',     Icon: BarChart2  },
  { to: '/m/trade',     label: 'Trade',     Icon: Zap        },
  { to: '/m/pp',        label: 'PP',        Icon: Shield     },
  { to: '/m/events',    label: 'Events',    Icon: Activity   },
  { to: '/m/brokers',   label: 'Brokers',   Icon: Building2  },
] as const

export function MobileTabBar() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-stretch border-t border-border/40 bg-background"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
              isActive ? 'text-foreground' : 'text-muted-foreground'
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={cn('h-5 w-5', isActive && 'text-primary')} strokeWidth={isActive ? 2 : 1.5} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
