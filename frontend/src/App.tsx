import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppLayout } from "@/components/layout/app-layout";
import { LoginPage } from "@/pages/login-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { ConnectBrokersPage } from "@/pages/connect-brokers-page";
import { NotFoundPage } from "@/pages/not-found-page";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/connect-brokers" element={<ConnectBrokersPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
