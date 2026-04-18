import { useEffect } from "react";
import { Routes, Route, Outlet, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppLayout } from "@/components/layout/app-layout";
import { AdminLayout } from "@/components/layout/admin-layout";
import { LandingPage } from "@/pages/landing-page";
import { LoginPage } from "@/pages/login-page";
import { AuthCallbackPage } from "@/pages/auth-callback-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { ConnectBrokersPage } from "@/pages/connect-brokers-page";
import { BrokerRedirectPage } from "@/pages/broker-redirect-page";
import { TerminalPage } from "@/pages/terminal-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { InactivePage } from "@/pages/inactive-page";
import { AdminDashboardPage } from "@/pages/admin/admin-dashboard-page";
import { AdminRiskLogsPage } from "@/pages/admin/admin-risk-logs-page";
import { AdminUsersPage } from "@/pages/admin/admin-users-page";
import { AdminSettingsPage } from "@/pages/admin/admin-settings-page";
import { AutoEntryPage } from "@/pages/auto-entry-page";
import { useRiskFeed } from "@/hooks/use-risk-feed";
import { useThemeStore } from "@/stores/theme-store";
import { MobileRoutes } from '@/mobile';

function RiskFeedMount() {
  useRiskFeed();
  return <Outlet />;
}

function App() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

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
          <Route path="/auto-entry" element={<AutoEntryPage />} />
          <Route path="/connect-brokers" element={<ConnectBrokersPage />} />
          <Route path="/redirect/:brokerId" element={<BrokerRedirectPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="risk-logs" element={<AdminRiskLogsPage />} />
            <Route path="users"    element={<AdminUsersPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>
        </Route>
        </Route>
      </Route>
      <Route path="/" element={<LandingPage />} />
      <Route path="/m/*" element={<MobileRoutes />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
