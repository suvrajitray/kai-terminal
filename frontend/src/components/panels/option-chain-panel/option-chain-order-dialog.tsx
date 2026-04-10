import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { QtyInput } from "@/components/ui/qty-input";
import { ArrowRightLeft, Pencil, X as XIcon, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
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

  const [broker, setBroker]             = useState<string>(() => activeBrokers[0]?.id ?? "upstox");
  const [direction, setDirection]       = useState<"Buy" | "Sell">(() => intent?.transactionType ?? "Buy");
  const [qtyValue, setQtyValue]         = useState("1");
  const [qtyMode, setQtyMode]           = useState<"qty" | "lot">("lot");
  const [product, setProduct]           = useState<"Intraday" | "Delivery">("Intraday");
  const [orderType, setOrderType]       = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice]     = useState(() => intent?.ltp.toFixed(2) ?? "0");
  const [placing, setPlacing]           = useState(false);
  const [availableMargin, setAvailable] = useState<number | null>(null);

  // Reset to defaults every time the dialog opens for a new intent
  useEffect(() => {
    if (!intent) return;
    setDirection(intent.transactionType);
    setOrderType("market");
    setProduct("Intraday");
    setQtyValue("1");
    setQtyMode("lot");
    setLimitPrice(intent.ltp.toFixed(2));
  }, [intent?.instrumentKey]);

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

  // Derived values — computed before early return so hook order is stable
  const isBuy    = direction === "Buy";
  const lotSize  = intent ? getLotSize(intent.underlying) : 1;
  const parsed   = parseInt(qtyValue, 10);
  const qty      = isNaN(parsed) || parsed <= 0 ? lotSize
                 : qtyMode === "lot" ? parsed * lotSize : parsed;
  const contract = intent ? getByInstrumentKey(intent.instrumentKey) : null;

  // Accent palette — green for Buy, red for Sell
  const accent = isBuy
    ? { border: "border-emerald-500", dot: "bg-emerald-500", btn: "bg-emerald-600 hover:bg-emerald-700", toggle: "bg-emerald-600" }
    : { border: "border-rose-500",    dot: "bg-rose-500",    btn: "bg-rose-600 hover:bg-rose-700",       toggle: "bg-rose-600"   };

  const marginInstruments = useMemo<MarginInstrument[] | null>(() => {
    if (!intent || qty <= 0) return null;
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

  const ltp = currentLtp ?? intent.ltp;

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
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden" showCloseButton={false}>

        <DialogTitle className="sr-only">
          {direction} {intent.underlying} {intent.strike} {intent.side}
        </DialogTitle>

        {/* Body */}
        <div className="px-5 pt-5 pb-4 space-y-5">

          {/* Header: instrument + LTP + buy/sell toggle */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-foreground">
                {intent.underlying} {intent.strike} {intent.side}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                NFO · LTP <span className="font-mono font-semibold text-foreground tabular-nums">{ltp.toFixed(2)}</span>
              </p>
            </div>
            {/* Direction toggle — always "on", color indicates Buy/Sell */}
            <button
              onClick={() => setDirection((d) => d === "Buy" ? "Sell" : "Buy")}
              className={cn(
                "relative mt-0.5 flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
                accent.toggle,
              )}
              title={`Switch to ${isBuy ? "Sell" : "Buy"}`}
            >
              <span className={cn(
                "absolute size-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                isBuy ? "translate-x-5" : "translate-x-0.5",
              )} />
            </button>
          </div>

          {/* Broker toggle */}
          {activeBrokers.length > 1 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowRightLeft className="size-3.5" />
                <span>Route via</span>
              </div>
              <div className="flex items-center gap-1 rounded-md border border-border/40 bg-muted/10 p-0.5">
                {activeBrokers.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBroker(b.id)}
                    className={cn(
                      "rounded px-3 py-1 text-xs font-semibold transition-all",
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

          {/* Product type */}
          <div className="flex items-center gap-6">
            {(["Intraday", "Delivery"] as const).map((p) => (
              <button key={p} onClick={() => setProduct(p)} className="flex items-center gap-2 group">
                <span className={cn(
                  "size-4 rounded-full border-2 flex items-center justify-center transition-colors",
                  product === p ? accent.border : "border-muted-foreground/30 group-hover:border-muted-foreground/50",
                )}>
                  {product === p && <span className={cn("size-2 rounded-full", accent.dot)} />}
                </span>
                <span className={cn("text-sm font-medium transition-colors", product === p ? "text-foreground" : "text-muted-foreground")}>
                  {p}
                </span>
                <span className="text-[11px] text-muted-foreground/50">
                  {p === "Intraday" ? "MIS" : "NRML"}
                </span>
              </button>
            ))}
          </div>

          {/* Lots + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Lots</p>
              <QtyInput
                value={qtyValue}
                mode={qtyMode}
                lotSize={lotSize}
                onChange={setQtyValue}
                onToggleMode={toggleMode}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {orderType === "market" ? "Market price" : "Price"}
              </p>
              <div className="flex h-9 overflow-hidden rounded border border-border bg-background">
                <div className={cn(
                  "flex flex-1 items-center px-3",
                  orderType === "market" && "bg-[repeating-linear-gradient(-45deg,rgb(255_255_255_/_0.06)_0px,rgb(255_255_255_/_0.06)_1px,transparent_1px,transparent_8px)]",
                )}>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={orderType === "market" ? "0" : limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    disabled={orderType === "market"}
                    className="w-full bg-transparent text-sm font-mono tabular-nums outline-none disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <button
                  onClick={() => {
                    if (orderType === "market") { setLimitPrice(ltp.toFixed(2)); setOrderType("limit"); }
                    else setOrderType("market");
                  }}
                  className="flex w-9 shrink-0 items-center justify-center border-l border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {orderType === "market" ? <Pencil className="size-3.5" /> : <XIcon className="size-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-px bg-border/40" />
        <div className="flex items-center gap-4 px-5 py-3">
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-[11px] text-muted-foreground">
              Required{" "}
              {marginLoading ? (
                <span className="font-mono animate-pulse">—</span>
              ) : margin != null ? (
                <span className={cn("font-mono font-semibold tabular-nums", marginColor)}>
                  ₹{margin.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              ) : (
                <span className="font-mono text-muted-foreground/40">—</span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Available{" "}
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {availableMargin != null
                  ? `₹${availableMargin.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                  : "—"}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              className={cn("h-10 w-24 font-bold text-white uppercase tracking-wide", accent.btn)}
              onClick={handlePlace}
              disabled={placing}
            >
              {placing ? (
                <><Zap className="mr-1.5 size-4 animate-pulse" />Placing…</>
              ) : (
                direction.toUpperCase()
              )}
            </Button>
            <Button variant="outline" className="h-10 w-24" onClick={onClose} disabled={placing}>
              Cancel
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
