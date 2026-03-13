import { Navigate } from "react-router-dom";
import { motion } from "motion/react";
import { Activity, TrendingUp, Shield, Zap, BarChart2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { APP_NAME, API_BASE_URL } from "@/lib/constants";

const FEATURES = [
  {
    icon: Zap,
    title: "Quick Trade",
    desc: "Place CE/PE/Both orders by target premium in one click",
  },
  {
    icon: TrendingUp,
    title: "Live P&L",
    desc: "Real-time positions with LTP updates via WebSocket",
  },
  {
    icon: Shield,
    title: "Risk Engine",
    desc: "Auto exit on stop loss, profit target, and trailing SL",
  },
  {
    icon: BarChart2,
    title: "Index Ticker",
    desc: "Live NIFTY, SENSEX, BANKNIFTY with change % always visible",
  },
  {
    icon: RefreshCw,
    title: "Shift Strikes",
    desc: "Roll positions to higher/lower strikes with one action",
  },
  {
    icon: Activity,
    title: "Order Stream",
    desc: "Real-time order updates and instant rejection alerts",
  },
];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  return (
    <div className="relative min-h-svh overflow-hidden bg-background">

      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-60 left-1/2 h-[700px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute bottom-20 right-0 h-[400px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Top nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
            <Activity className="size-4 text-primary" />
          </div>
          <span className="font-semibold tracking-tight">{APP_NAME}</span>
        </div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleLogin}>
            <GoogleIcon />
            Sign in
          </Button>
        </motion.div>
      </nav>

      {/* Hero */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 pb-20 pt-16 text-center sm:px-10 sm:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Built for Indian F&amp;O traders
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl"
        >
          Trade smarter.
          <br />
          <span className="text-primary">React faster.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg"
        >
          A professional trading terminal with real-time positions, one-click option orders,
          and an automated risk engine — built for serious F&amp;O traders.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col items-center gap-3"
        >
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              size="lg"
              className="h-12 gap-3 px-8 text-base font-semibold shadow-lg shadow-primary/20"
              onClick={handleLogin}
            >
              <GoogleIcon />
              Continue with Google
            </Button>
          </motion.div>
        </motion.div>
      </div>

      {/* Features grid */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 pb-24 sm:px-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.45 + i * 0.06 }}
              className="rounded-xl border border-border/40 bg-card/40 p-4 backdrop-blur-sm"
            >
              <div className="mb-3 flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="size-4 text-primary" />
              </div>
              <p className="mb-1 text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

    </div>
  );
}
