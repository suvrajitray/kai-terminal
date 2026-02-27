import { type ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import http from "@/services/http";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    http
      .get("/api/profile")
      .then(() => setOk(true))
      .catch(() => setOk(false));
  }, []);

  if (ok === null) return null;
  return ok ? <>{children}</> : <Navigate to="/login" />;
}
