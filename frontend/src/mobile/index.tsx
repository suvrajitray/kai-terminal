import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { MobileLayout } from './layout/mobile-layout'
import { MobilePositionsPage } from './pages/mobile-positions-page'
import { MobileChainPage } from './pages/mobile-chain-page'
import { MobileQuickTradePage } from './pages/mobile-quick-trade-page'
import { MobilePPPage } from './pages/mobile-pp-page'
import { MobileBrokersPage } from './pages/mobile-brokers-page'
import { MobileEventsPage } from './pages/mobile-events-page'

export function MobileRoutes() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route element={<MobileLayout />}>
          <Route index element={<Navigate to="positions" replace />} />
          <Route path="positions" element={<MobilePositionsPage />} />
          <Route path="chain"     element={<MobileChainPage />} />
          <Route path="trade"     element={<MobileQuickTradePage />} />
          <Route path="pp"        element={<MobilePPPage />} />
          <Route path="events"    element={<MobileEventsPage />} />
          <Route path="brokers"   element={<MobileBrokersPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
