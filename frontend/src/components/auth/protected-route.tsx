import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { isTokenExpired } from "@/lib/token-utils";
import { performLogout } from "@/lib/logout";

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isActive = useAuthStore((s) => s.isActive);
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  // When the browser tab comes back into focus after a long time (e.g. 2 days),
  // React may not re-render — so the inline expiry check below never fires.
  // This listener catches that case and clears state immediately on tab focus.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const currentToken = useAuthStore.getState().token;
      if (currentToken && isTokenExpired(currentToken)) {
        performLogout();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

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
