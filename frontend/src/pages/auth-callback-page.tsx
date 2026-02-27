import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

function parseJwtPayload(token: string): { sub: string; name: string; email: string } | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    return {
      sub:
        payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] ??
        payload.sub,
      name:
        payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] ?? payload.name,
      email:
        payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] ??
        payload.email,
    };
  } catch {
    return null;
  }
}

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const claims = parseJwtPayload(token);
    if (!claims) {
      navigate("/login", { replace: true });
      return;
    }

    login({ id: claims.sub, name: claims.name, email: claims.email }, token);
    navigate("/dashboard", { replace: true });
  }, [searchParams, login, navigate]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}
