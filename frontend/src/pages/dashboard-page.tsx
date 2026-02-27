import { motion } from "motion/react";
import { IndianRupee, TrendingUp, BarChart3, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  { title: "Portfolio Value", value: "--", icon: IndianRupee },
  { title: "Today's P&L", value: "--", icon: TrendingUp },
  { title: "Open Positions", value: "--", icon: BarChart3 },
  { title: "Pending Orders", value: "--", icon: ClipboardList },
];

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      <Card>
        <CardContent className="flex h-64 items-center justify-center text-muted-foreground">
          Connect a broker to view live data
        </CardContent>
      </Card>
    </div>
  );
}
