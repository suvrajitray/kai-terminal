import { Link, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { UserMenu } from "./user-menu";

export function Header() {
  const { pathname } = useLocation();

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
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  pathname === item.path
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <UserMenu />
      </div>
    </motion.header>
  );
}
