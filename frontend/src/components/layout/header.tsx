import { Link, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Activity, LayoutDashboard, MonitorDot, BarChart3, BrainCircuit, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { UserMenu } from "./user-menu";
import { IndexTicker } from "./index-ticker";
import { QuickTradeButton } from "./quick-trade-button";
import { MarketStatus } from "./market-status";
import { useBrokerStore } from "@/stores/broker-store";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard":  LayoutDashboard,
  "/terminal":   MonitorDot,
  "/charts":     BarChart3,
  "/ai-signals": BrainCircuit,
};

export function Header() {
  const { pathname } = useLocation();
  const brokerAuthenticated = useBrokerStore((s) => s.isAuthenticated("upstox"));

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm"
    >
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
            <Activity className="size-5 text-primary" />
            <span>{APP_NAME}</span>
          </Link>
          <nav className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = NAV_ICONS[item.path];
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-md bg-accent"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                    />
                  )}
                  <span className="relative flex items-center gap-1.5">
                    {Icon && <Icon className="size-3.5" />}
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <MarketStatus />
          {brokerAuthenticated && <IndexTicker />}
          {brokerAuthenticated && <QuickTradeButton />}
          <UserMenu />
        </div>
      </div>
    </motion.header>
  );
}
