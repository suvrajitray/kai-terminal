import { useEffect, useState } from "react";
import { Eye, EyeOff, Save, ShieldCheck, Users, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { getAnalyticsToken, saveAnalyticsToken, getUsers, setUserActive, type AdminUser } from "@/services/admin-api";
import { useAuthStore } from "@/stores/auth-store";
import { Navigate } from "react-router";
import { toast } from "sonner";

export function AdminPage() {
  const isAdmin = useAuthStore((s) => s.isAdmin);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          System-wide configuration. Changes apply to all users.
        </p>
      </div>

      <UserManagementCard />
      <AnalyticsTokenCard />
    </div>
  );
}

function UserManagementCard() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(user: AdminUser) {
    setToggling(user.id);
    try {
      await setUserActive(user.id, !user.isActive);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u))
      );
      toast.success(`${user.name} ${!user.isActive ? "activated" : "deactivated"}`);
    } catch {
      toast.error("Failed to update user");
    } finally {
      setToggling(null);
    }
  }

  return (
    <Card className="border-border/40 bg-muted/10">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">User Access</CardTitle>
        </div>
        <CardDescription>
          Activate or deactivate user accounts. New users are inactive until approved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading users…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users found.</p>
        ) : (
          <div className="divide-y divide-border/40">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{user.name}</span>
                    {user.isAdmin && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        Admin
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-3">
                  {user.isActive ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-500">
                      <CheckCircle2 className="size-3" /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <XCircle className="size-3" /> Inactive
                    </span>
                  )}
                  <Switch
                    checked={user.isActive}
                    disabled={user.isAdmin || toggling === user.id}
                    onCheckedChange={() => handleToggle(user)}
                    aria-label={`Toggle ${user.name}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AnalyticsTokenCard() {
  const [token, setToken]       = useState("");
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    getAnalyticsToken()
      .then(setToken)
      .catch(() => toast.error("Failed to load analytics token"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await saveAnalyticsToken(token);
      toast.success("Analytics token saved");
    } catch {
      toast.error("Failed to save analytics token");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-xl border-border/40 bg-muted/10">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Upstox Analytics Token</CardTitle>
        </div>
        <CardDescription>
          Read-only token used to fetch option contract master data (instrument list, strikes,
          expiries). Obtain from the Upstox Developer Portal under Analytics Token.
          Updating this token clears the contract cache on the next request.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="analytics-token">Token</Label>
          <div className="relative">
            <Input
              id="analytics-token"
              type={revealed ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={loading ? "Loading…" : "Paste analytics token here"}
              disabled={loading}
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <Button onClick={handleSave} disabled={loading || saving} size="sm">
          <Save className="mr-2 size-4" />
          {saving ? "Saving…" : "Save Token"}
        </Button>
      </CardContent>
    </Card>
  );
}
