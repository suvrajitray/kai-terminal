import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { isTokenExpired } from "@/lib/token-utils";
import { performLogout } from "@/lib/logout";

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isActive = useAuthStore((s) => s.isActive);
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  if (isAuthenticated && token && isTokenExpired(token)) {
    performLogout();
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isActive) {
    return <Navigate to="/auth/inactive" replace />;
  }

  return <Outlet />;
}
