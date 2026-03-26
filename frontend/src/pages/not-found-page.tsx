import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
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

      <div className="relative z-10 flex flex-col items-center gap-4 rounded-2xl border border-border/50 bg-card/60 px-12 py-10 text-center shadow-xl shadow-black/20 backdrop-blur-md">
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <p className="text-muted-foreground">Page not found</p>
        <Button asChild>
          <Link to="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>

    </div>
  );
}
