import { Routes, Route, Outlet } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppLayout } from "@/components/layout/app-layout";
import { LandingPage } from "@/pages/landing-page";
import { LoginPage } from "@/pages/login-page";
import { AuthCallbackPage } from "@/pages/auth-callback-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { ConnectBrokersPage } from "@/pages/connect-brokers-page";
import { BrokerRedirectPage } from "@/pages/broker-redirect-page";
import { TerminalPage } from "@/pages/terminal-page";
import { ChartsPage } from "@/pages/charts-page";
import { AiSignalsPage } from "@/pages/ai-signals-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { InactivePage } from "@/pages/inactive-page";
import { AdminPage } from "@/pages/admin-page";
import { useRiskFeed } from "@/hooks/use-risk-feed";

function RiskFeedMount() {
  useRiskFeed();
  return <Outlet />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/auth/inactive" element={<InactivePage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<RiskFeedMount />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/terminal" element={<TerminalPage />} />
          <Route path="/charts" element={<ChartsPage />} />
          <Route path="/ai-signals" element={<AiSignalsPage />} />
          <Route path="/connect-brokers" element={<ConnectBrokersPage />} />
          <Route path="/redirect/:brokerId" element={<BrokerRedirectPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        </Route>
      </Route>
      <Route path="/" element={<LandingPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
