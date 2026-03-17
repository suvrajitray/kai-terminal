import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { performLogout } from "@/lib/logout";

export function InactivePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex flex-col items-center gap-3">
        <ShieldOff className="size-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Account Pending Activation</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your account is pending activation. Please contact the administrator to gain access.
        </p>
      </div>
      <Button variant="outline" onClick={performLogout}>
        Sign out
      </Button>
    </div>
  );
}
