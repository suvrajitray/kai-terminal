import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, CheckCircle2, ChevronDown, KeyRound, LogIn, PlugZap, Copy, Check, Webhook } from "lucide-react";
import { BROKERS } from "@/lib/constants";
import { BrokerCard } from "@/components/brokers/broker-card";
import { useBrokerStore } from "@/stores/broker-store";
import { fetchBrokerCredentials } from "@/services/broker-api";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { cn } from "@/lib/utils";

type BrokerStatus = "active" | "expired" | "missing";

function getBrokerStatus(
  isConnected: (id: string) => boolean,
  getCredentials: (id: string) => { accessToken?: string } | undefined,
  brokerId: string,
): BrokerStatus {
  if (!isConnected(brokerId)) return "missing";
  const token = getCredentials(brokerId)?.accessToken;
  if (isBrokerTokenExpired(brokerId, token)) return token ? "expired" : "missing";
  return "active";
}

function CopyUrl({ url, label = "Copy URL" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-1.5 flex items-center gap-1.5 rounded border border-border/40 bg-muted/30 px-2.5 py-1.5">
      <span className="flex-1 truncate font-mono text-[11px] text-foreground/80">{url}</span>
      <button
        onClick={copy}
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        title={label}
      >
        {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
      </button>
    </div>
  );
}

function HowToConnect({ zerodhaApiKey, upstoxApiKey }: { zerodhaApiKey?: string; upstoxApiKey?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab]   = useState<"upstox" | "zerodha">("upstox");

  const redirectUrl = (broker: string) => `${window.location.origin}/redirect/${broker}`;
  const webhookUrl = (broker: string) => {
    const key = broker === "zerodha" ? (zerodhaApiKey || "YOUR_API_KEY") : (upstoxApiKey || "YOUR_API_KEY");
    return `${window.location.origin}/api/webhooks/${broker}/order?apiKey=${key}`;
  };

  const steps = [
    {
      icon: KeyRound,
      title: "Get API credentials",
      upstox: "Go to Upstox Developer → My Apps → create an app. Set the redirect URL below, then copy the API Key and Secret.",
      zerodha: "Go to Kite Connect → Your Apps → create an app. Set the redirect URL below, then copy the API Key and Secret.",
      showRedirect: true,
      showWebhook: false,
    },
    {
      icon: PlugZap,
      title: "Enter credentials",
      upstox: 'Click "Connect" on the Upstox card and paste your API Key and Secret.',
      zerodha: 'Click "Connect" on the Zerodha card and paste your API Key and Secret.',
      showRedirect: false,
      showWebhook: false,
    },
    {
      icon: LogIn,
      title: "Authenticate daily",
      upstox: "Click \"Authenticate\" → log in with your Upstox account → you'll be redirected back automatically.",
      zerodha: "Click \"Authenticate\" → log in with your Zerodha account → you'll be redirected back automatically.",
      showRedirect: false,
      showWebhook: false,
    },
    {
      icon: Webhook,
      title: "Configure postback (optional)",
      upstox: "In your Upstox app settings, set the Postback URL below. KAI Terminal will push order-fill notifications to your browser instantly — no waiting for the next poll.",
      zerodha: "In your Kite app settings, set the Postback URL below. The URL includes your API key so KAI Terminal can route the notification to the right account.",
      showRedirect: false,
      showWebhook: true,
    },
  ];

  return (
    <div className="rounded-lg border border-border/40 bg-muted/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>How to connect a broker?</span>
        <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 px-4 pb-4 pt-3 space-y-4">
              {/* Broker tab toggle */}
              <div className="flex gap-1 rounded-lg border border-border/40 bg-background p-0.5 w-fit">
                {(["upstox", "zerodha"] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setTab(b)}
                    className={cn(
                      "rounded-md px-4 py-1 text-xs font-semibold capitalize transition-all",
                      tab === b
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {b === "upstox" ? "Upstox" : "Zerodha"}
                  </button>
                ))}
              </div>

              {/* Steps */}
              <ol className="space-y-4">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-[11px] font-bold text-muted-foreground">
                      {i + 1}
                    </div>
                    <div className="flex-1 space-y-0.5 pt-0.5">
                      <p className="text-xs font-semibold text-foreground">{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step[tab]}</p>
                      {step.showRedirect && <CopyUrl url={redirectUrl(tab)} label="Copy redirect URL" />}
                      {step.showWebhook && <CopyUrl url={webhookUrl(tab)} label="Copy webhook URL" />}
                    </div>
                  </li>
                ))}
              </ol>

              <p className="text-[11px] text-muted-foreground/60 border-t border-border/30 pt-3">
                Broker sessions expire daily. Re-authenticate each morning before trading.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ConnectBrokersPage() {
  const saveCredentials  = useBrokerStore((s) => s.saveCredentials);
  const getCredentials   = useBrokerStore((s) => s.getCredentials);
  const isConnected      = useBrokerStore((s) => s.isConnected);

  useEffect(() => {
    fetchBrokerCredentials()
      .then((credentials) => {
        for (const cred of credentials) {
          saveCredentials(cred.brokerName, {
            apiKey: cred.apiKey,
            apiSecret: cred.apiSecret,
            redirectUrl: `${window.location.origin}/redirect/${cred.brokerName}`,
            accessToken: getCredentials(cred.brokerName)?.accessToken,
          });
        }
      })
      .catch(() => {
        // silently ignore — store may already have persisted data
      });
  }, [saveCredentials]);

  const zerodhaApiKey = getCredentials("zerodha")?.apiKey;
  const upstoxApiKey  = getCredentials("upstox")?.apiKey;

  // Only care about brokers that have been set up (have API credentials)
  const connectedBrokers = BROKERS.filter((b) => isConnected(b.id));

  const statuses = connectedBrokers.map((b) => ({
    broker: b,
    status: getBrokerStatus(isConnected, getCredentials, b.id),
  }));

  const anyNeedsReAuth = statuses.some((s) => s.status !== "active");
  const multipleConnected = connectedBrokers.length > 1;

  return (
    <div className="relative space-y-6">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-20 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
      <div>
        <h1 className="text-2xl font-semibold">Connect Brokers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {anyNeedsReAuth
            ? "Authenticate your broker to start trading."
            : "Link your brokerage accounts to start trading."}
        </p>
      </div>

      <HowToConnect zerodhaApiKey={zerodhaApiKey} upstoxApiKey={upstoxApiKey} />

      {anyNeedsReAuth && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {multipleConnected ? (
            // Multi-broker: per-broker status rows
            <div className="flex flex-col gap-2">
              {statuses.map(({ broker, status }) => {
                const isOk = status === "active";
                return (
                  <div
                    key={broker.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm",
                      isOk
                        ? "border-green-500/30 bg-green-500/10"
                        : "border-amber-500/30 bg-amber-500/10",
                    )}
                  >
                    {isOk ? (
                      <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                    ) : (
                      <AlertCircle className="size-4 shrink-0 text-amber-500" />
                    )}
                    <div className="flex items-baseline gap-2">
                      <span className={cn("font-medium", isOk ? "text-green-500" : "text-amber-500")}>
                        {broker.name}
                      </span>
                      <span className="text-muted-foreground">
                        {isOk
                          ? "Session active"
                          : status === "expired"
                            ? "Session expired — re-authenticate below to resume trading."
                            : "Not authenticated — authenticate below to start trading."}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Single broker: same row style, no need for separate layout
            <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
              <AlertCircle className="size-4 shrink-0 text-amber-500" />
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-amber-500">
                  {statuses[0]?.broker.name}
                </span>
                <span className="text-muted-foreground">
                  {statuses[0]?.status === "expired"
                    ? "Session expired — re-authenticate below to resume trading."
                    : "Not authenticated — authenticate below to start trading."}
                </span>
              </div>
            </div>
          )}
        </motion.div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BROKERS.map((broker, i) => (
          <motion.div
            key={broker.id}
            className="h-full"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <BrokerCard broker={broker} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
