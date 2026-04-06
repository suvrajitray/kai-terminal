import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { Users, Settings2, LayoutDashboard, ShieldAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const ADMIN_NAV: { label: string; path: string; icon: LucideIcon }[] = [
  { label: "Dashboard",       path: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Risk Event Logs", path: "/admin/risk-logs", icon: ShieldAlert     },
  { label: "User Access",     path: "/admin/users",    icon: Users     },
  { label: "System Settings", path: "/admin/settings", icon: Settings2 },
];

export function AdminLayout() {
  const isAdmin = useAuthStore((s) => s.isAdmin);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex gap-8">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}

function AdminSidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="w-48 shrink-0 border-r border-border/40 pr-6">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Admin
      </p>
      <nav className="flex flex-col gap-0.5">
        {ADMIN_NAV.map(({ label, path, icon: Icon }) => {
          const active = pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors",
                active
                  ? "border-l-2 border-primary bg-muted/40 pl-[10px] text-foreground"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
