import { useEffect, useState } from "react";
import { Activity, Users, CheckCircle, Server, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAdminDashboardStats, type AdminDashboardStats } from "@/services/admin-api";

const MOCK_EVENTS = [
  { id: 1, time: "2 mins ago", type: "System", message: "Database backup completed successfully", status: "success" },
  { id: 2, time: "15 mins ago", type: "User", message: "New user registration: 'john_doe'", status: "info" },
  { id: 3, time: "1 hour ago", type: "API", message: "Upstox API rate limit approaching (85%)", status: "warning" },
  { id: 4, time: "3 hours ago", type: "Admin", message: "Admin setting 'Global Risk Limit' updated", status: "success" },
  { id: 5, time: "5 hours ago", type: "API", message: "Shoonya broker connection lost briefly", status: "error" },
];

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);

  useEffect(() => {
    getAdminDashboardStats()
      .then(setStats)
      .catch(console.error);
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform health and high-level metrics across the system.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-muted/10 border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active / Online</CardTitle>
            <Users className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-baseline gap-2">
              {stats ? `${stats.activeUsers} / ${stats.onlineUsers}` : "-- / --"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Out of {stats?.totalUsers ?? "--"} registered users
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted/10 border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orders Today</CardTitle>
            <Activity className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">1,248</div>
            <p className="text-xs text-muted-foreground mt-1">
              +15% from yesterday
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted/10 border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">API Health</CardTitle>
            <CheckCircle className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">99.8%</div>
            <p className="text-xs text-muted-foreground mt-1">
              All broker APIs operational
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted/10 border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">System Latency</CardTitle>
            <Server className="size-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">42ms</div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg backend response time
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/10 border-border/40 col-span-3">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold">Recent System Events</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Global audit log of the last few hours.</p>
          </div>
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded border border-transparent hover:border-border/50 hover:bg-muted/20">
            <RefreshCw className="size-4" />
          </button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-y border-border/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground w-32">Time</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground w-24">Type</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Event Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {MOCK_EVENTS.map((event) => (
                  <tr key={event.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{event.time}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="font-normal border-primary/20 bg-primary/5 text-primary text-[10px]">
                        {event.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 flex items-center gap-2">
                      <span className={`size-1.5 rounded-full shrink-0 ${
                        event.status === 'success' ? 'bg-green-500' :
                        event.status === 'warning' ? 'bg-amber-500' :
                        event.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                      }`} />
                      <span className="text-foreground">{event.message}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
