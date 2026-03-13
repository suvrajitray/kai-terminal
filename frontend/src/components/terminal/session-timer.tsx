import { useSyncExternalStore } from "react";
import { Timer } from "lucide-react";

function subscribe(cb: () => void) {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
}
const getSnapshot = () => Date.now();

function getSessionElapsed(): { h: number; m: number; s: number } | null {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const h = ist.getHours(), m = ist.getMinutes(), s = ist.getSeconds();
  const totalMins = h * 60 + m;
  if (totalMins < 9 * 60 + 15 || totalMins >= 15 * 60 + 30) return null;
  const elapsedSecs = (h - 9) * 3600 + (m - 15) * 60 + s;
  return {
    h: Math.floor(elapsedSecs / 3600),
    m: Math.floor((elapsedSecs % 3600) / 60),
    s: elapsedSecs % 60,
  };
}

export function SessionTimer() {
  useSyncExternalStore(subscribe, getSnapshot);
  const elapsed = getSessionElapsed();
  if (!elapsed) return null;

  const { h, m, s } = elapsed;
  const label = h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m`
    : `${m}m ${String(s).padStart(2, "0")}s`;

  return (
    <span
      className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"
      title="Time since market open (09:15 IST)"
    >
      <Timer className="size-3 shrink-0" />
      {label}
    </span>
  );
}
