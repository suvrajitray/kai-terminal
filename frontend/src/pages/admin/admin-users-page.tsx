import { useEffect, useState, useMemo } from "react";
import { Users, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getUsers, setUserActive, type AdminUser } from "@/services/admin-api";
import { toast } from "@/lib/toast";

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
  const [activeFilter, setActiveFilter] = useState("all");
  const [onlineFilter, setOnlineFilter] = useState("all");

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (activeFilter === "active" && !u.isActive) return false;
      if (activeFilter === "inactive" && u.isActive) return false;
      if (onlineFilter === "online" && !u.isOnline) return false;
      if (onlineFilter === "offline" && u.isOnline) return false;
      return true;
    });
  }, [users, activeFilter, onlineFilter]);

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
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Users</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Toggle the switch to activate or deactivate a user. Admin accounts cannot be deactivated.
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Status</SelectItem>
                <SelectItem value="active" className="text-xs">Active</SelectItem>
                <SelectItem value="inactive" className="text-xs">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <div className="w-px h-5 bg-border/60 mx-1" />
            <Select value={onlineFilter} onValueChange={setOnlineFilter}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue placeholder="Online State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Activity</SelectItem>
                <SelectItem value="online" className="text-xs">Online</SelectItem>
                <SelectItem value="offline" className="text-xs">Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading users…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users found.</p>
        ) : filteredUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users match the selected filters.</p>
        ) : (
          <div className="divide-y divide-border/40">
            {filteredUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span 
                      title={user.isOnline ? "Online Today" : "Offline"} 
                      className={`size-2 rounded-full shrink-0 ${user.isOnline ? "bg-green-500" : "bg-muted-foreground/30"}`} 
                    />
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
