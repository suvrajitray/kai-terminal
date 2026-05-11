import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getUserBrokers, getUserPositions, type AdminPosition } from "@/services/admin-api";

const INR = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PRODUCT_LABEL: Record<string, string> = {
  Intraday: "Intraday",
  Delivery: "Delivery",
  Mtf: "MTF",
  CoverOrder: "Cover Order",
};

// All NSE/BSE F&O index strikes are ≥ 10000, so we use that to disambiguate
// the MMDD expiry prefix (3 digits for Jan–Sep, 4 digits for Oct–Dec).
const INDEX_PREFIXES = ["BANKNIFTY", "FINNIFTY", "BANKEX", "SENSEX", "NIFTY"];

function parseAdminSymbol(symbol: string): { index: string; strike: string; type: "CE" | "PE" } | null {
  const upper = symbol.toUpperCase();
  const type = upper.endsWith("CE") ? "CE" : upper.endsWith("PE") ? "PE" : null;
  if (!type) return null;

  const withoutType = upper.slice(0, -2);
  const index = INDEX_PREFIXES.find((p) => withoutType.startsWith(p));
  if (!index) return null;

  const rest = withoutType.slice(index.length); // e.g. "2651223950"
  if (rest.length < 7) return null;

  const afterYear = rest.slice(2); // strip YY

  // Monthly expiry: 3 uppercase letters + digits (e.g. MAY23950)
  const monthly = afterYear.match(/^[A-Z]{3}(\d+)$/);
  if (monthly) return { index, strike: monthly[1], type };

  // Weekly expiry: MMDD (3 or 4 digits) + strike (must be ≥ 10000)
  for (const expLen of [4, 3]) {
    const candidate = afterYear.slice(expLen);
    if (/^\d{4,6}$/.test(candidate) && parseInt(candidate) >= 10000) {
      return { index, strike: candidate, type };
    }
  }

  return null;
}

function SymbolCell({ p }: { p: AdminPosition }) {
  const parsed = parseAdminSymbol(p.tradingSymbol);
  if (parsed) {
    return (
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 font-medium text-sm whitespace-nowrap">
          {parsed.index} {parsed.strike}
          <span className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold",
            parsed.type === "PE"
              ? "bg-emerald-500/15 text-emerald-500"
              : "bg-rose-500/15 text-rose-500",
          )}>
            {parsed.type}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground">{p.exchange}</div>
      </td>
    );
  }
  return (
    <td className="px-3 py-2.5">
      <div className="font-medium text-sm">{p.tradingSymbol}</div>
      <div className="text-[11px] text-muted-foreground">{p.exchange}</div>
    </td>
  );
}

function PnlValue({ value }: { value: number }) {
  const color = value > 0 ? "text-emerald-500" : value < 0 ? "text-rose-500" : "text-muted-foreground";
  return (
    <span className={cn("font-mono tabular-nums font-medium", color)}>
      {value >= 0 ? "+" : ""}₹{INR.format(value)}
    </span>
  );
}

export function PositionsDialog({
  user,
  open,
  onClose,
}: {
  user: { email: string; name: string };
  open: boolean;
  onClose: () => void;
}) {
  const [brokers, setBrokers] = useState<string[]>([]);
  const [broker, setBroker] = useState<"upstox" | "zerodha">("upstox");
  const [positions, setPositions] = useState<AdminPosition[] | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    getUserBrokers(user.email).then((list) => {
      setBrokers(list);
      if (list.length > 0) setBroker(list[0] as "upstox" | "zerodha");
    });
  }, [open, user.email]);

  useEffect(() => {
    if (!open || !broker) return;
    setLoading(true);
    setPositions(undefined);
    getUserPositions(user.email, broker)
      .then(setPositions)
      .catch(() => setPositions([]))
      .finally(() => setLoading(false));
  }, [open, user.email, broker]);

  const openPositions   = positions?.filter(p => p.isOpen)  ?? [];
  const closedPositions = positions?.filter(p => !p.isOpen) ?? [];
  const totalPnl        = positions?.reduce((sum, p) => sum + p.pnl, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-base">Positions — {user.name}</DialogTitle>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </DialogHeader>

        {brokers.length > 1 && (
          <div className="flex gap-1 mt-1">
            {brokers.map((b) => (
              <button
                key={b}
                onClick={() => setBroker(b as "upstox" | "zerodha")}
                className={cn(
                  "px-3 py-1 rounded text-xs capitalize transition-colors",
                  broker === b
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {b}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-[65vh] overflow-auto space-y-4">
          {loading ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Loading…</p>
          ) : !positions || positions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              No positions found for {broker}.
            </p>
          ) : (
            <>
              {openPositions.length > 0 && (
                <PositionTable label="Open" rows={openPositions} />
              )}
              {closedPositions.length > 0 && (
                <PositionTable label="Closed" rows={closedPositions} />
              )}

              <div className="flex items-center justify-between px-1 pt-1 pb-0.5 border-t border-border/40">
                <span className="text-xs text-muted-foreground">
                  Total P&amp;L — {positions.length} position{positions.length !== 1 ? "s" : ""}
                </span>
                <PnlValue value={totalPnl} />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PositionTable({ label, rows }: { label: string; rows: AdminPosition[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 px-0.5">
        {label}
      </p>
      <div className="rounded-md border border-border/30 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 border-b border-border/30">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Symbol</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Product</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground w-16">Qty</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Avg</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">LTP</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground w-28">P&amp;L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {rows.map((p, i) => (
              <tr key={i} className={cn(
                "transition-colors hover:bg-muted/20",
                p.quantity === 0 && "[&>td]:opacity-50",
              )}>
                <SymbolCell p={p} />
                <td className="px-3 py-2.5 text-muted-foreground">
                  {PRODUCT_LABEL[p.product] ?? p.product}
                </td>
                <td className={cn(
                  "px-3 py-2.5 text-right tabular-nums font-semibold",
                  p.quantity < 0 ? "text-rose-500" : p.quantity > 0 ? "text-emerald-500" : "text-muted-foreground",
                )}>
                  {p.quantity > 0 ? "+" : ""}{p.quantity}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  ₹{INR.format(p.averagePrice)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  ₹{INR.format(p.ltp)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <PnlValue value={p.pnl} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
