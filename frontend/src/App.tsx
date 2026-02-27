import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppLayout } from "@/components/layout/app-layout";
import { LoginPage } from "@/pages/login-page";
import { AuthCallbackPage } from "@/pages/auth-callback-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { ConnectBrokersPage } from "@/pages/connect-brokers-page";
import { BrokerRedirectPage } from "@/pages/broker-redirect-page";
import { NotFoundPage } from "@/pages/not-found-page";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/connect-brokers" element={<ConnectBrokersPage />} />
          <Route path="/redirect/:brokerId" element={<BrokerRedirectPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
