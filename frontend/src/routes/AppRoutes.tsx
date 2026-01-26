import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "@/pages/auth/LoginPage";
import HomePage from "@/pages/home/HomePage";
import ConnectBrokerPage from "@/pages/broker/ConnectBrokerPage";
import AuthCallback from "@/pages/auth/AuthCallback";
import ProtectedRoute from "./ProtectedRoutes";

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/connect-broker"
        element={
          <ProtectedRoute>
            <ConnectBrokerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/auth/callback"
        element={<AuthCallback />}
      />
      <Route
        path="*"
        element={<Navigate to="/" />}
      />
    </Routes>
  );
}
