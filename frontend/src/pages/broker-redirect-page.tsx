import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link, Navigate } from "react-router-dom";
import { motion } from "motion/react";
import { CheckCircle2, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BROKERS } from "@/lib/constants";
import { useBrokerStore } from "@/stores/broker-store";
import { exchangeAccessToken, updateBrokerAccessToken } from "@/services/broker-api";

export function BrokerRedirectPage() {
  const { brokerId } = useParams<{ brokerId: string }>();
  const [searchParams] = useSearchParams();
  const broker = BROKERS.find((b) => b.id === brokerId);

  const getCredentials = useBrokerStore((s) => s.getCredentials);
  const setAccessToken = useBrokerStore((s) => s.setAccessToken);

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    const code = searchParams.get("code");
    if (!code || !brokerId) {
      setStatus("error");
      setError("Authorization code not found in redirect URL.");
      return;
    }

    const creds = getCredentials(brokerId);
    if (!creds) {
      setStatus("error");
      setError("Broker credentials not found. Please connect the broker first.");
      return;
    }

    exchangeAccessToken(creds.apiKey, creds.apiSecret, creds.redirectUrl, code)
      .then(async (accessToken) => {
        setAccessToken(brokerId, accessToken);
        await updateBrokerAccessToken(brokerId, accessToken);
        setStatus("success");
      })
      .catch((err: Error) => {
        setError(err.message);
        setStatus("error");
      });
  }, [brokerId, searchParams, getCredentials, setAccessToken]);

  if (!broker) {
    return <Navigate to="/connect-brokers" replace />;
  }

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="w-full max-w-lg">
          <CardHeader>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="flex items-center gap-3"
            >
              {status === "loading" && (
                <Loader2 className="size-8 shrink-0 animate-spin text-muted-foreground" />
              )}
              {status === "success" && (
                <CheckCircle2 className="size-8 shrink-0" style={{ color: broker.color }} />
              )}
              {status === "error" && <AlertCircle className="size-8 shrink-0 text-destructive" />}
              <CardTitle className="text-xl">
                {status === "loading" && "Authenticating…"}
                {status === "success" && "Authentication Successful"}
                {status === "error" && "Authentication Failed"}
              </CardTitle>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <CardDescription className="pt-2 text-sm">
                {status === "loading" && `Exchanging authorization code with ${broker.name}…`}
                {status === "success" && (
                  <>
                    Successfully authenticated with{" "}
                    <span className="font-medium text-foreground">{broker.name}</span>. Your access
                    token has been saved. You can now use the trading terminal.
                  </>
                )}
                {status === "error" && (error ?? "An unexpected error occurred.")}
              </CardDescription>
            </motion.div>
          </CardHeader>

          {status !== "loading" && (
            <CardContent>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.5 }}
                className="flex gap-3"
              >
                {status === "success" ? (
                  <>
                    <Button asChild className="flex-1">
                      <Link to="/terminal">
                        Open Terminal
                        <ArrowRight className="ml-2 size-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <Link to="/dashboard">Dashboard</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="outline" className="flex-1">
                      <Link to="/connect-brokers">Back to Brokers</Link>
                    </Button>
                  </>
                )}
              </motion.div>
            </CardContent>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
