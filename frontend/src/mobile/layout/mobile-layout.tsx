import { Outlet } from 'react-router-dom'
import { MobileHeader } from './mobile-header'
import { MobileTabBar } from './mobile-tab-bar'

export function MobileLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <MobileHeader />
      <main className="flex-1 overflow-y-auto pb-20">
        {/* pb-20 clears the fixed tab bar (h-16) + some breathing room */}
        <Outlet />
      </main>
      <MobileTabBar />
    </div>
  )
}
