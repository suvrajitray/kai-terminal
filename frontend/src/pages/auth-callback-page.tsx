import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useBrokerStore } from "@/stores/broker-store";
import { BROKERS } from "@/lib/constants";
import { fetchBrokerCredentials } from "@/services/broker-api";
import { isBrokerTokenExpired } from "@/lib/token-utils";

function parseJwtPayload(token: string): { sub: string; name: string; email: string; isActive: boolean; isAdmin: boolean } | null {
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
      isActive: payload.isActive === "true" || payload.isActive === true,
      isAdmin:  payload.isAdmin  === "true" || payload.isAdmin  === true,
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
    const run = async () => {
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

      login({ id: claims.sub, name: claims.name, email: claims.email }, token, claims.isActive, claims.isAdmin);

      // Hydrate broker store from DB — restores valid tokens across logout/login cycles
      try {
        const stored = await fetchBrokerCredentials();
        for (const cred of stored) {
          if (cred.accessToken) {
            useBrokerStore.getState().saveCredentials(cred.brokerName, {
              apiKey: cred.apiKey,
              apiSecret: cred.apiSecret,
              redirectUrl: "",
              accessToken: cred.accessToken,
            });
          }
        }
      } catch {
        // ignore — fall through to connect-brokers if fetch fails
      }

      // If any broker has a non-expired token, go straight to terminal.
      const anyValid = BROKERS.some((b) => {
        const t = useBrokerStore.getState().getCredentials(b.id)?.accessToken;
        return !isBrokerTokenExpired(b.id, t);
      });
      navigate(anyValid ? "/terminal" : "/connect-brokers", { replace: true });
    };
    run();
  }, [searchParams, login, navigate]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}
