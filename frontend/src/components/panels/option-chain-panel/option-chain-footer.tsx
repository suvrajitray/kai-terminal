import { cn } from "@/lib/utils";
import type { HedgeSuggestion } from "./hedge-suggestion";
import { FooterStat, Sep } from "./footer-stat";
import { MaxPainStat } from "./max-pain-stat";

interface OptionChainFooterProps {
  underlying: string;
  spotPrice: number;
  atmStrike: number;
  atmIv: number | null;
  pcr: number | null;
  ivRank: number | null;
  ivPercentile: number | null;
  ivHistoryDays: number;
  expectedMovePct: number | null;
  expectedMovePts: number | null;
  maxPain: number | null;
  netDelta?: number;
  hedgeSuggestion: HedgeSuggestion | null;
}

export function OptionChainFooter({
  underlying,
  spotPrice,
  atmStrike,
  atmIv,
  pcr,
  ivRank,
  ivPercentile,
  ivHistoryDays,
  expectedMovePct,
  expectedMovePts,
  maxPain,
  netDelta,
  hedgeSuggestion,
}: OptionChainFooterProps) {
  return (
    <div className="flex shrink-0 flex-col border-t border-border bg-background">
      <PrimaryStats
        spotPrice={spotPrice}
        atmStrike={atmStrike}
        atmIv={atmIv}
        pcr={pcr}
        ivRank={ivRank}
        ivPercentile={ivPercentile}
        ivHistoryDays={ivHistoryDays}
      />
      <MoveStats
        expectedMovePct={expectedMovePct}
        expectedMovePts={expectedMovePts}
        maxPain={maxPain}
        spotPrice={spotPrice}
      />
      {netDelta !== undefined && (
        <HedgeStats
          underlying={underlying}
          netDelta={netDelta}
          hedgeSuggestion={hedgeSuggestion}
        />
      )}
    </div>
  );
}

function PrimaryStats({
  spotPrice,
  atmStrike,
  atmIv,
  pcr,
  ivRank,
  ivPercentile,
  ivHistoryDays,
}: Pick<OptionChainFooterProps, "spotPrice" | "atmStrike" | "atmIv" | "pcr" | "ivRank" | "ivPercentile" | "ivHistoryDays">) {
  return (
    <div className="flex h-8 items-center gap-3 border-b border-border/20 px-3">
      <FooterStat label="Spot" value={spotPrice > 0 ? spotPrice.toFixed(1) : "—"} />
      <Sep />
      <FooterStat label="ATM" value={atmStrike > 0 ? String(atmStrike) : "—"} />
      {atmIv !== null && (
        <>
          <Sep />
          <FooterStat label="IV" value={`${atmIv.toFixed(1)}%`} valueClass="text-amber-400" />
        </>
      )}
      {pcr !== null && (
        <>
          <Sep />
          <FooterStat
            label="PCR"
            value={pcr.toFixed(2)}
            valueClass={pcr >= 1 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}
          />
        </>
      )}
      {ivRank !== null && ivHistoryDays >= 10 && (
        <>
          <Sep />
          <FooterStat
            label="IVR"
            value={ivRank.toFixed(0)}
            valueClass={ivRank >= 50 ? "text-emerald-600 dark:text-emerald-400" : ivRank >= 30 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}
            title={`IV Rank ${ivRank.toFixed(0)}/100 — higher than ${ivPercentile?.toFixed(0)}% of past ${ivHistoryDays} days`}
          />
        </>
      )}
      {ivHistoryDays > 0 && ivHistoryDays < 10 && (
        <>
          <Sep />
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/30">IVR collecting…</span>
        </>
      )}
    </div>
  );
}

function MoveStats({
  expectedMovePct,
  expectedMovePts,
  maxPain,
  spotPrice,
}: Pick<OptionChainFooterProps, "expectedMovePct" | "expectedMovePts" | "maxPain" | "spotPrice">) {
  return (
    <div className="flex h-8 items-center gap-3 border-b border-border/20 px-3">
      {expectedMovePct !== null && expectedMovePts !== null ? (
        <span
          className="flex items-center gap-1.5"
          title="ATM straddle price ÷ spot — market's implied range to expiry"
        >
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50">±Move</span>
          <span className="font-mono text-[11px] font-semibold tabular-nums text-sky-400">
            {expectedMovePct.toFixed(2)}%
          </span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/40">
            {Math.round(expectedMovePts)} pts
          </span>
        </span>
      ) : (
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/30">Move —</span>
      )}
      {maxPain !== null && (
        <>
          <Sep />
          <MaxPainStat maxPain={maxPain} spotPrice={spotPrice} />
        </>
      )}
    </div>
  );
}

function HedgeStats({
  underlying,
  netDelta,
  hedgeSuggestion,
}: {
  underlying: string;
  netDelta: number;
  hedgeSuggestion: HedgeSuggestion | null;
}) {
  return (
    <div className="flex h-8 items-center gap-2 bg-muted/30 px-3">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40 shrink-0">Δ Hedge</span>
      <Sep />
      {hedgeSuggestion === null ? (
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "font-mono text-[11px] font-semibold tabular-nums",
              Math.abs(netDelta) < 1 ? "text-emerald-400" : "text-muted-foreground/60",
            )}
          >
            {netDelta > 0 ? "+" : ""}{netDelta.toFixed(1)}
          </span>
          <span className="text-[10px] text-emerald-400/60">Balanced</span>
        </span>
      ) : (
        <span className="flex items-center gap-2 overflow-hidden">
          <span className={cn("font-mono text-[11px] font-semibold tabular-nums shrink-0", netDelta < 0 ? "text-rose-400" : "text-amber-400")}>
            {netDelta > 0 ? "+" : ""}{netDelta.toFixed(1)}
          </span>
          <span className="text-muted-foreground/30 shrink-0">→</span>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
              hedgeSuggestion.side === "PE" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
            )}
          >
            Sell {hedgeSuggestion.lots}L
          </span>
          <span className="font-mono text-[10px] text-foreground/80 shrink-0">
            {underlying} {hedgeSuggestion.strike}{" "}
            <span className={hedgeSuggestion.side === "PE" ? "text-emerald-400" : "text-rose-400"}>
              {hedgeSuggestion.side}
            </span>
          </span>
          {hedgeSuggestion.ltp > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground/40 shrink-0">
              @ {hedgeSuggestion.ltp.toFixed(1)}
            </span>
          )}
          <span className="text-muted-foreground/30 shrink-0">→</span>
          <span
            className={cn(
              "font-mono text-[10px] font-medium tabular-nums shrink-0",
              Math.abs(hedgeSuggestion.residualDelta) < 5 ? "text-emerald-400/80" : "text-amber-400/80",
            )}
          >
            Δ {hedgeSuggestion.residualDelta > 0 ? "+" : ""}{hedgeSuggestion.residualDelta.toFixed(1)}
          </span>
        </span>
      )}
    </div>
  );
}

