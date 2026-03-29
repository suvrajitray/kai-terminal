import { useEffect, useState } from "react";
import { Users, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { getUsers, setUserActive, type AdminUser } from "@/services/admin-api";
import { toast } from "sonner";

export function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">User Access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Activate or deactivate user accounts. New users are inactive until approved.
        </p>
      </div>
      <UserManagementCard />
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
          <CardTitle className="text-base">Users</CardTitle>
        </div>
        <CardDescription>
          Toggle the switch to activate or deactivate a user. Admin accounts cannot be deactivated.
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
