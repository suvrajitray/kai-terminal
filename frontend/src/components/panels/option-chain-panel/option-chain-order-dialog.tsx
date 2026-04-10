import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { QtyInput } from "@/components/ui/qty-input";
import { ArrowRightLeft, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { placeOrder, fetchFunds, fetchZerodhaFunds, type MarginInstrument } from "@/services/trading-api";
import { useBrokerStore } from "@/stores/broker-store";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { getLotSize } from "@/lib/lot-sizes";
import { BROKERS } from "@/lib/constants";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { useDirectMarginEstimate } from "@/components/layout/use-margin-estimate";

export interface OrderIntent {
  instrumentKey: string;
  side: "CE" | "PE";
  transactionType: "Buy" | "Sell";
  ltp: number;
  strike: number;
  underlying: string;
}

interface Props {
  intent: OrderIntent | null;
  currentLtp?: number;
  onClose: () => void;
}

export function OptionChainOrderDialog({ intent, currentLtp, onClose }: Props) {
  const credentials        = useBrokerStore((s) => s.credentials);
  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);

  const activeBrokers = BROKERS.filter(
    (b) => !isBrokerTokenExpired(b.id, credentials[b.id]?.accessToken),
  );

  const [broker, setBroker]         = useState<string>(() => activeBrokers[0]?.id ?? "upstox");
  const [qtyValue, setQtyValue]     = useState("1");
  const [qtyMode, setQtyMode]       = useState<"qty" | "lot">("lot");
  const [product, setProduct]       = useState<"Intraday" | "Delivery">("Intraday");
  const [orderType, setOrderType]   = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState(() => intent?.ltp.toFixed(2) ?? "0");
  const [placing, setPlacing]           = useState(false);
  const [availableMargin, setAvailable] = useState<number | null>(null);

  useEffect(() => {
    setAvailable(null);
    if (!intent) return;
    const creds = useBrokerStore.getState().getCredentials(broker);
    if (broker === "zerodha" && creds?.apiKey && creds?.accessToken) {
      fetchZerodhaFunds(creds.apiKey, creds.accessToken)
        .then((f) => setAvailable(f.availableMargin))
        .catch(() => {});
    } else if (broker === "upstox") {
      fetchFunds()
        .then((f) => setAvailable(f.availableMargin))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broker, !!intent]);

  // Derived values — computed even when intent is null so hooks order is stable
  const lotSize   = intent ? getLotSize(intent.underlying) : 1;
  const parsed    = parseInt(qtyValue, 10);
  const qty       = isNaN(parsed) || parsed <= 0 ? lotSize
                  : qtyMode === "lot" ? parsed * lotSize : parsed;
  const contract  = intent ? getByInstrumentKey(intent.instrumentKey) : null;
  const direction = intent?.transactionType ?? "Buy";

  const marginInstruments = useMemo<MarginInstrument[] | null>(() => {
    if (!intent || qty <= 0) return null;
    // Both brokers expect the Upstox instrument key (NSE_FO|{exchangeToken}).
    // The Zerodha margin endpoint extracts exchangeToken from the | format and resolves internally.
    return [{ instrumentToken: intent.instrumentKey, quantity: qty, product: product === "Intraday" ? "I" : "D", transactionType: direction.toUpperCase() }];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.instrumentKey, qty, product, direction]);

  const { margin, loading: marginLoading } = useDirectMarginEstimate(marginInstruments, broker as "upstox" | "zerodha");

  const marginColor =
    margin == null || availableMargin == null ? "text-foreground"
    : margin > availableMargin               ? "text-rose-400"
    : availableMargin < margin * 1.15        ? "text-amber-400"
    :                                          "text-foreground";

  if (!intent) return null;

  const ltp   = currentLtp ?? intent.ltp;
  const isBuy = direction === "Buy";

  const toggleMode = () => {
    setQtyMode((prev) => {
      const next = prev === "lot" ? "qty" : "lot";
      const cur  = parseInt(qtyValue, 10);
      if (!isNaN(cur) && cur > 0)
        setQtyValue(next === "qty" ? String(cur * lotSize) : String(Math.max(1, Math.round(cur / lotSize))));
      return next;
    });
  };

  async function handlePlace() {
    setPlacing(true);
    try {
      let token = intent!.instrumentKey;
      if (broker === "zerodha" && contract?.contract.zerodhaToken) {
        token = contract.contract.zerodhaToken;
      }
      const price = orderType === "limit" ? parseFloat(limitPrice) : undefined;
      await placeOrder(token, qty, direction, product, orderType, price, broker);
      toast.success(`${direction} order placed`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <Dialog open={!!intent} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className={cn("text-lg font-bold", isBuy ? "text-green-400" : "text-red-400")}>
            {direction} {intent.underlying} {intent.strike} {intent.side}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Broker toggle — top, only when multiple brokers connected */}
          {activeBrokers.length > 1 && (
            <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowRightLeft className="size-3.5" />
                <span>Route via</span>
              </div>
              <div className="flex items-center gap-1 rounded-md border border-border/40 bg-background p-0.5">
                {activeBrokers.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBroker(b.id)}
                    className={cn(
                      "rounded px-3 py-1 text-xs font-semibold transition-all capitalize",
                      broker === b.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {b.id === "upstox" ? "Upstox" : "Zerodha"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LTP + Order type row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              LTP <span className="font-mono font-semibold text-foreground tabular-nums">{ltp.toFixed(2)}</span>
            </span>
            <div className="flex h-7 items-center gap-0.5 rounded-md border border-border/40 bg-muted/20 p-0.5">
              {(["market", "limit"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    if (t === "limit" && orderType === "market") setLimitPrice(ltp.toFixed(2));
                    setOrderType(t);
                  }}
                  className={cn(
                    "rounded px-2.5 py-0.5 text-xs font-semibold capitalize transition-all",
                    orderType === t
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity + Product row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quantity</p>
              <QtyInput
                value={qtyValue}
                mode={qtyMode}
                lotSize={lotSize}
                onChange={setQtyValue}
                onToggleMode={toggleMode}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</p>
              <div className="flex h-9 items-center gap-1 rounded-lg border border-border/40 bg-muted/20 p-1">
                {(["Intraday", "Delivery"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setProduct(p)}
                    className={cn(
                      "flex-1 h-full rounded-md text-xs font-semibold transition-all",
                      product === p
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p === "Intraday" ? "Intraday" : "Delivery"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Price + Margin row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price</p>
              <Input
                type="number"
                step="0.05"
                min="0"
                value={orderType === "market" ? "0" : limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                disabled={orderType === "market"}
                className={cn(
                  "h-9 font-mono text-sm",
                  orderType === "market" && "cursor-not-allowed bg-[repeating-linear-gradient(-45deg,transparent,transparent_4px,hsl(var(--muted)/0.3)_4px,hsl(var(--muted)/0.3)_8px)]",
                )}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Margin</p>
              <div className="flex h-9 items-center rounded-md border border-border/40 bg-muted/20 px-3">
                {marginLoading ? (
                  <span className="text-xs font-mono text-muted-foreground animate-pulse">—</span>
                ) : margin != null ? (
                  <span className={cn("text-xs font-mono tabular-nums font-semibold", marginColor)}>
                    ₹{margin.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                ) : (
                  <span className="text-xs font-mono text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Place button */}
          <Button
            className={cn(
              "h-11 w-full text-base font-bold text-white",
              isBuy ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700",
            )}
            onClick={handlePlace}
            disabled={placing}
          >
            {placing ? (
              <><Zap className="mr-2 size-4 animate-pulse" />Placing…</>
            ) : (
              `${direction} ${qty} qty`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
