import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { BadgeCheck, CheckCircle2, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BROKERS } from "@/lib/constants";
import { useBrokerStore } from "@/stores/broker-store";
import { useUserTradingSettingsStore } from "@/stores/user-trading-settings-store";
import { exchangeAccessToken, updateBrokerAccessToken } from "@/services/broker-api";
import { fetchUserTradingSettings } from "@/services/user-settings-api";
import { toast } from "sonner";

interface Step {
  message: string;
  done: boolean;
}

export function BrokerRedirectPage() {
  const { brokerId } = useParams<{ brokerId: string }>();
  const [searchParams] = useSearchParams();
  const broker = BROKERS.find((b) => b.id === brokerId);

  const getCredentials = useBrokerStore((s) => s.getCredentials);
  const setAccessToken = useBrokerStore((s) => s.setAccessToken);
  const setTradingSettings = useUserTradingSettingsStore((s) => s.setSettings);

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const calledRef = useRef(false);

  const addStep = (message: string) =>
    setSteps((prev) => [...prev, { message, done: true }]);

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

    (async () => {
      try {
        // Step 1 — exchange code for token
        const accessToken = await exchangeAccessToken(creds.apiKey, creds.apiSecret, creds.redirectUrl, code);
        setAccessToken(brokerId, accessToken);
        addStep("Broker authentication complete");

        // Step 2 — persist token to database
        await updateBrokerAccessToken(brokerId, accessToken);
        addStep("Session secured and synced");

        // Step 3 — fetch user trading settings
        const settings = await fetchUserTradingSettings();
        setTradingSettings(settings);
        addStep("User trading settings loaded");

        setStatus("success");
        toast.success("Happy Trading! 🎉");
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        setStatus("error");
      }
    })();
  }, [brokerId, searchParams, getCredentials, setAccessToken, setTradingSettings]);

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
        <Card className="w-[500px] max-w-[calc(100vw-2rem)]">
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
                <CheckCircle2 className="size-8 shrink-0 text-green-500" />
              )}
              {status === "error" && (
                <AlertCircle className="size-8 shrink-0 text-destructive" />
              )}
              <CardTitle className="whitespace-nowrap text-xl">
                {status === "loading" && "Authenticating…"}
                {status === "success" && "Authentication Successful"}
                {status === "error" && "Authentication Failed"}
              </CardTitle>
            </motion.div>

            {status === "error" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                <CardDescription className="pt-2 text-sm text-destructive">
                  {error}
                </CardDescription>
              </motion.div>
            )}
          </CardHeader>

          {(steps.length > 0 || status === "loading") && <Separator />}

          {/* Step list */}
          {(steps.length > 0 || status === "loading") && (
            <CardContent className="pb-4 pt-4">
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {steps.map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center gap-3 text-sm"
                    >
                      <BadgeCheck className="size-5 shrink-0 text-green-500" />
                      <span className="text-foreground">{step.message}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {status === "loading" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 text-sm text-muted-foreground"
                  >
                    <Loader2 className="size-5 shrink-0 animate-spin" />
                    <span>
                      {steps.length === 0 && `Exchanging authorization code with ${broker.name}…`}
                      {steps.length === 1 && "Saving access token to database…"}
                      {steps.length === 2 && "Loading user trading settings…"}
                    </span>
                  </motion.div>
                )}
              </div>
            </CardContent>
          )}

          {/* Action buttons */}
          {status !== "loading" && (
            <CardContent className={steps.length > 0 ? "pt-2" : ""}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
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
                  <Button asChild variant="outline" className="flex-1">
                    <Link to="/connect-brokers">Back to Brokers</Link>
                  </Button>
                )}
              </motion.div>
            </CardContent>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
