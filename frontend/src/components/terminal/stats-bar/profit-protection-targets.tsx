import { Fragment } from "react";
import { BrokerBadge } from "@/components/ui/broker-badge";
import type { PpBrokerEntry } from "./types";

interface ProfitProtectionTargetsProps {
  ppBrokers: PpBrokerEntry[];
}

export function ProfitProtectionTargets({ ppBrokers }: ProfitProtectionTargetsProps) {
  if (ppBrokers.length === 0) return null;

  return (
    <>
      <div className="h-4 w-px bg-border" />
      <span className="flex items-center gap-1.5 text-xs">
        {ppBrokers.length === 1 ? (
          <TargetValues target={ppBrokers[0].target} currentSl={ppBrokers[0].currentSl} />
        ) : (
          ppBrokers.map((entry, index) => (
            <Fragment key={entry.broker}>
              {index > 0 && <div className="h-4 w-px bg-border" />}
              <span className="flex items-center gap-1">
                <BrokerBadge brokerId={entry.broker} />
                <TargetValues target={entry.target} currentSl={entry.currentSl} />
              </span>
            </Fragment>
          ))
        )}
      </span>
    </>
  );
}

function TargetValues({ target, currentSl }: { target: number; currentSl: number }) {
  return (
    <>
      <span className="text-muted-foreground">TGT</span>
      <span className="font-mono font-medium tabular-nums text-emerald-500">
        ₹{target.toLocaleString("en-IN")}
      </span>
      <span className="text-muted-foreground">SL</span>
      <span className="font-mono font-medium tabular-nums text-rose-500">
        ₹{currentSl.toLocaleString("en-IN")}
      </span>
    </>
  );
}

