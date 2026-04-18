import { Link, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Activity, Bot, LayoutDashboard, MonitorDot, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { UserMenu } from "./user-menu";
import { IndexTicker } from "./index-ticker";
import { QuickTradeButton } from "./quick-trade-button";
import { MarketStatus } from "./market-status";
import { BrokerStatusChips } from "./broker-status-chips";
import { ThemeToggle } from "./theme-toggle";
import { useBrokerStore } from "@/stores/broker-store";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard":  LayoutDashboard,
  "/terminal":   MonitorDot,
  "/auto-entry": Bot,
};

export function Header() {
  const { pathname } = useLocation();
  const isUpstoxAuthed  = useBrokerStore((s) => s.isAuthenticated("upstox"));
  const isZerodhaAuthed = useBrokerStore((s) => s.isAuthenticated("zerodha"));
  const brokerAuthenticated = isUpstoxAuthed || isZerodhaAuthed;

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative sticky top-0 z-50 bg-background/80 backdrop-blur-sm"
    >
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <Activity className="size-4 text-primary" />
            </div>
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
          <BrokerStatusChips />
          {brokerAuthenticated && <QuickTradeButton />}
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
    </motion.header>
  );
}
