import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { performLogout } from "@/lib/logout";

export function InactivePage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-4">

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-primary/7 blur-[140px]" />
      </div>

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 rounded-2xl border border-border/50 bg-card/60 px-10 py-10 text-center shadow-xl shadow-black/20 backdrop-blur-md">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-muted/50 ring-1 ring-border/40">
            <ShieldOff className="size-5 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold">Account Pending Activation</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your account is pending activation. Please contact the administrator to gain access.
          </p>
        </div>
        <Button variant="outline" onClick={performLogout}>
          Sign out
        </Button>
      </div>

    </div>
  );
}
