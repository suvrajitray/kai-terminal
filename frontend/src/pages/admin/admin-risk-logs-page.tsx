import { useEffect, useState, useMemo } from "react";
import { RefreshCw, ShieldAlert, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAdminRiskLogs, type RiskLogEntry } from "@/services/admin-api";
import { cn } from "@/lib/utils";

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts;
  }
}

function StatusNode({ type }: { type: string }) {
  const t = type.toLowerCase();
  const isError = t.includes("loss") || t.includes("rejected") || t.includes("error");
  const isWarning = t.includes("stoploss") || t.includes("auto");
  const isSuccess = t.includes("profit") || t.includes("target") || t.includes("success");
  
  return (
    <span className={cn("size-2 rounded-full shrink-0",
      isSuccess ? 'bg-green-500' :
      isError ? 'bg-red-500' : 
      isWarning ? 'bg-amber-500' : 'bg-blue-500'
    )} title={type} />
  )
}

function fmt(n: number) {
  if (n == null) return "--";
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function AdminRiskLogsPage() {
  const [logs, setLogs] = useState<RiskLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState("All Users");
  const [days, setDays] = useState("1");

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminRiskLogs(undefined, parseInt(days, 10));
      setLogs(data);
    } catch (e: any) {
      setError(e.message || "Failed to fetch risk logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [days]);

  const users = useMemo(() => {
    const list = Array.from(new Set(logs.map(l => l.user || "Unknown")));
    return ["All Users", ...list];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return selectedUser === "All Users" 
      ? logs 
      : logs.filter(l => (l.user || "Unknown") === selectedUser);
  }, [logs, selectedUser]);

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">User Risk Engine Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Audit log of individual user risk events and alerts across the system.</p>
      </div>

      <Card className="bg-muted/10 border-border/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-500" />
            <CardTitle className="text-base font-semibold">Events History</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {error && (
              <span className="flex items-center gap-1 text-xs text-destructive mr-2">
                <AlertCircle className="size-3" /> {error}
              </span>
            )}
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-32 h-8 text-xs font-medium">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1" className="text-xs">Today</SelectItem>
                <SelectItem value="7" className="text-xs">Last 7 Days</SelectItem>
              </SelectContent>
            </Select>
            <div className="w-px h-5 bg-border/60 mx-1" />
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Filter by User" />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button 
              onClick={fetchLogs}
              disabled={loading}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded border border-transparent hover:border-border/50 hover:bg-muted/20 disabled:opacity-50 disabled:cursor-not-allowed">
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-y border-border/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground w-40">Time</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground w-32">User</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Action</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground w-20">SL</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground w-20">Target</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground w-20">TSL</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground w-24">TSL Floor</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground w-28">MTM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      <Loader2 className="size-5 animate-spin mx-auto mb-2 opacity-50" />
                      Loading risk logs...
                    </td>
                  </tr>
                ) : filteredLogs.length > 0 ? filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <StatusNode type={log.type} />
                        {formatTime(log.timestamp)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-medium">{log.user || "Unknown"}</td>
                    <td className="px-4 py-2.5">{log.type}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">{fmt(log.sl)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">{fmt(log.target)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">{log.shiftCount ?? "--"}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">{fmt(log.tslFloor)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                      <span className={log.mtm >= 0 ? "text-green-500" : "text-red-500"}>
                        {log.mtm >= 0 ? "+" : ""}₹{fmt(log.mtm)}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No events found for {selectedUser}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
