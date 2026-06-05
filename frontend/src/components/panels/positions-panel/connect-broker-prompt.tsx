import { Link2, Check, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Inline empty-state shown in the positions pane when no broker is connected.
 * Positions and order placement require a broker token; the rest of the terminal
 * (option chain, indices, analytics) does not — so this is framed as partial
 * access with a clear CTA, not an error. Rendered flat (no card chrome) so it
 * reads as an empty state inside the pane, not a modal dialog.
 */
const LIVE_WITHOUT_BROKER = [
  "Live option chain & Greeks",
  "Index spot, IV & analytics",
  "Payoff and hedge tools",
];

export function ConnectBrokerPrompt() {
  const navigate = useNavigate();

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden p-6">
      {/* Ambient glow for depth — no card, so it blends into the pane */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[260px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.04] blur-[120px]" />
      </div>

      <div className="relative z-10 flex w-full max-w-[16rem] flex-col items-center gap-4 text-center">
        {/* Icon badge with soft glow */}
        <div className="relative">
          <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md" />
          <div className="relative flex size-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 ring-1 ring-inset ring-white/5">
            <Link2 className="size-[18px] text-primary" />
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Connect a broker to trade
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Live positions and order placement need a broker. Everything else is
            already running.
          </p>
        </div>

        <ul className="flex flex-col gap-1.5 py-1">
          {LIVE_WITHOUT_BROKER.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-2 text-left text-[11px] text-muted-foreground/80"
            >
              <Check className="size-3 shrink-0 text-emerald-400" />
              {feature}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => navigate("/connect-brokers")}
          className="group mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:underline"
        >
          Connect a broker
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
