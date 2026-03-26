import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  Activity,
  TrendingUp,
  Shield,
  Zap,
  BarChart2,
  RefreshCw,
  ArrowRight,
  Layers,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

const FEATURES = [
  { icon: Zap,        title: "Quick Trade",   desc: "Place CE/PE/Both orders by premium or option chain in one click." },
  { icon: TrendingUp, title: "Live P&L",       desc: "Real-time positions with LTP via WebSocket. Watch MTM move live." },
  { icon: Shield,     title: "Risk Engine",    desc: "Auto SL, target, and trailing SL. Engine exits — you don't watch." },
  { icon: BarChart2,  title: "Index Ticker",   desc: "NIFTY, SENSEX, BANKNIFTY, FINNIFTY, BANKEX with O/H/L always on." },
  { icon: RefreshCw,  title: "Multi-Broker",   desc: "Upstox and Zerodha simultaneously in one unified positions view." },
  { icon: Activity,   title: "Order Stream",   desc: "Instant fill, rejection and completion alerts as they happen." },
  { icon: Layers,     title: "Option Chain",   desc: "Live chain, straddle/strangle builder, one-click margin estimate." },
  { icon: Timer,      title: "Session Timer",  desc: "Countdown to close so you're never caught past 3:25 PM." },
];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export function LandingPage() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-background text-foreground">

      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-60 left-1/2 h-[700px] w-[1000px] -translate-x-1/2 rounded-full bg-primary/7 blur-[160px]" />
        <div className="absolute bottom-0 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-primary/4 blur-[140px]" />
      </div>

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />

      <div className="relative z-10 flex min-h-svh w-full flex-col px-8 sm:px-14 xl:px-20">

        {/* Navbar */}
        <nav className="flex items-center justify-between py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/20">
              <Activity className="size-4 text-primary" />
            </div>
            <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>
          </div>
          <Link to="/login">
            <Button variant="outline" size="sm" className="h-9 gap-2 border-border/60 text-sm hover:bg-muted/40">
              <GoogleIcon />
              Sign in
            </Button>
          </Link>
        </nav>

        {/* Hero */}
        <section className="flex flex-col items-center pb-7 pt-10 text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1 text-xs font-medium text-primary">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              Built for Indian F&amp;O traders
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl"
          >
            The terminal that
            <br />
            <span className="text-primary">thinks with you.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.16 }}
            className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Real-time positions, one-click option orders, and an automated risk engine —
            everything a serious F&amp;O trader needs, in one place.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.24 }}
            className="mt-6"
          >
            <Link to="/login">
              <Button size="lg" className="h-11 gap-2 px-7 text-base font-semibold shadow-lg shadow-primary/20">
                Get started
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </motion.div>

          {/* Brokers + stats inline row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-2.5"
          >
            {["Zerodha", "Upstox"].map((b) => (
              <span key={b} className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card/50 px-3.5 py-1 text-xs font-medium">
                <span className="size-1.5 rounded-full bg-green-500" />
                {b}
              </span>
            ))}
            <span className="rounded-full border border-border/30 bg-muted/20 px-3.5 py-1 text-xs text-muted-foreground">
              + more brokers coming
            </span>
            <span className="mx-1 h-3 w-px bg-border/40" />
            <span className="text-xs text-muted-foreground">5 indices</span>
            <span className="text-border/40">·</span>
            <span className="text-xs text-muted-foreground">&lt; 50ms LTP</span>
            <span className="text-border/40">·</span>
            <span className="text-xs text-muted-foreground">1-click orders</span>
          </motion.div>
        </section>

        {/* Divider */}
        <div className="border-t border-border/30" />

        {/* Features */}
        <section className="flex-1 py-7">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="mb-6 text-center"
          >
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Everything in{" "}
              <span className="relative">
                <span className="text-primary">one terminal</span>
                <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              </span>
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              No switching between apps. No missed exits. No manual stop losses.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.42 + i * 0.04 }}
                className="group relative overflow-hidden rounded-xl border border-border/40 bg-card/30 p-5 backdrop-blur-sm transition-all duration-250 hover:border-primary/35 hover:bg-card/60 hover:shadow-md hover:shadow-primary/5"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity duration-250 group-hover:opacity-100" />
                <div
                  className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-250 group-hover:opacity-100"
                  style={{ background: "radial-gradient(ellipse at top left, hsl(var(--primary) / 0.06), transparent 65%)" }}
                />
                <div className="relative">
                  <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15 transition-all duration-250 group-hover:bg-primary/18 group-hover:ring-primary/35">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <p className="mb-1.5 text-sm font-semibold">{title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Footer / CTA */}
        <footer className="border-t border-border/30 py-4">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="flex items-center gap-2">
              <Activity className="size-3.5 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">{APP_NAME}</span>
              <span className="mx-1 text-border/40">·</span>
              <span className="text-xs text-muted-foreground">For personal use. Not SEBI registered.</span>
            </div>
            <Link to="/login">
              <Button variant="outline" size="sm" className="h-9 gap-2 border-border/60 text-sm hover:bg-muted/40">
                <GoogleIcon />
                Continue with Google
              </Button>
            </Link>
          </div>
        </footer>

      </div>
    </div>
  );
}
