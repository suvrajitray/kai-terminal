import { useEffect, useState, type ReactNode } from "react";
import { toast } from "@/lib/toast";
import { Zap, TrendingUp, TrendingDown, ArrowUpDown, Layers, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QtyInput, type QtyMode } from "@/components/ui/qty-input";
import { ByChainTab } from "./by-chain-tab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UNDERLYING_KEYS } from "@/lib/shift-config";
import { getLotSize } from "@/lib/lot-sizes";
import { placeOrderByPrice } from "@/services/trading-api";
import { useBrokerStore } from "@/stores/broker-store";
import { useOptionContractsStore } from "@/stores/option-contracts-store";

const UNDERLYINGS = Object.keys(UNDERLYING_KEYS);

function formatExpiry(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();
  const month = date.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
  const suffix = d === 1 || d === 21 || d === 31 ? "st" : d === 2 || d === 22 ? "nd" : d === 3 || d === 23 ? "rd" : "th";
  return `${day}, ${d}${suffix} ${month} ${y}`;
}

type Direction = "Buy" | "Sell";
type ActionType = "CE" | "PE" | "BOTH";

interface Props {
  onTabChange?: (tab: string) => void;
}

export function QuickTradeDialog({ onTabChange }: Props) {
  const isUpstoxAuthed  = useBrokerStore((s) => s.isAuthenticated("upstox"));
  const isZerodhaAuthed = useBrokerStore((s) => s.isAuthenticated("zerodha"));
  const bothConnected   = isUpstoxAuthed && isZerodhaAuthed;

  const [broker, setBroker]         = useState<"upstox" | "zerodha">(() =>
    isUpstoxAuthed ? "upstox" : "zerodha",
  );
  const [underlying, setUnderlying] = useState("NIFTY");
  const [expiry, setExpiry]         = useState("");
  const [qtyValue, setQtyValue]     = useState("");
  const [qtyMode, setQtyMode]       = useState<QtyMode>("lot");
  const [product, setProduct]       = useState<"I" | "D">("I");
  const [activeTab, setActiveTab]   = useState("price");

  const getExpiries = useOptionContractsStore((s) => s.getExpiries);
  const expiries = getExpiries(underlying);

  useEffect(() => {
    setExpiry(expiries[0] ?? "");
  }, [underlying, expiries.length]);

  const lotSize  = getLotSize(underlying);
  const num      = parseInt(qtyValue, 10);
  const quantity = isNaN(num) || num <= 0 ? lotSize : qtyMode === "lot" ? num * lotSize : num;

  const toggleQtyMode = () => {
    setQtyMode((prev) => {
      const next: QtyMode = prev === "lot" ? "qty" : "lot";
      const cur = parseInt(qtyValue, 10);
      if (!isNaN(cur) && cur > 0) {
        setQtyValue(
          next === "qty" ? String(cur * lotSize) : String(Math.max(1, Math.round(cur / lotSize))),
        );
      }
      return next;
    });
  };

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    onTabChange?.(tab);
  }

  // Shared controls rendered inside each tab
  const sharedControls = (
    <div className="space-y-4">
      {/* Broker selector — only shown when both brokers are connected */}
      {bothConnected && (
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowRightLeft className="size-3.5" />
            <span>Route via</span>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border/40 bg-background p-0.5">
            {(["upstox", "zerodha"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBroker(b)}
                className={cn(
                  "cursor-pointer rounded px-3 py-1 text-xs font-semibold transition-all capitalize",
                  broker === b
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {b === "upstox" ? "Upstox" : "Zerodha"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Underlying */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Underlying</p>
        <div className="flex flex-wrap gap-1.5">
          {UNDERLYINGS.map((u) => (
            <button
              key={u}
              onClick={() => setUnderlying(u)}
              className={cn(
                "rounded px-3 py-1 text-xs font-semibold transition-colors border",
                underlying === u
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Expiry + Product */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Expiry</p>
          <Select value={expiry} onValueChange={setExpiry} disabled={expiries.length === 0}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={expiries.length === 0 ? "No contracts" : "Select expiry"}>
                {expiry ? formatExpiry(expiry) : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {expiries.map((e) => (
                <SelectItem key={e} value={e}>{formatExpiry(e)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Product</p>
          <div className="flex h-9 items-center gap-4">
            {(["I", "D"] as const).map((p) => (
              <button key={p} onClick={() => setProduct(p)} className="flex items-center gap-2 group">
                <span className={cn(
                  "size-4 rounded-full border-2 flex items-center justify-center transition-colors",
                  product === p ? "border-primary" : "border-muted-foreground/30 group-hover:border-muted-foreground/50",
                )}>
                  {product === p && <span className="size-2 rounded-full bg-primary" />}
                </span>
                <span className={cn("text-sm font-medium transition-colors", product === p ? "text-foreground" : "text-muted-foreground")}>
                  {p === "I" ? "Intraday" : "Delivery"}
                </span>
                <span className="text-[11px] text-muted-foreground/50">{p === "I" ? "MIS" : "NRML"}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="w-full mb-5">
        <TabsTrigger value="price" className="flex-1 gap-1.5">
          <TrendingUp className="size-3.5" />
          By Price
        </TabsTrigger>
        <TabsTrigger value="chain" className="flex-1 gap-1.5">
          <Layers className="size-3.5" />
          By Chain
        </TabsTrigger>
      </TabsList>

      {/* ── By Price ─────────────────────────────────────────────────── */}
      <TabsContent value="price" className="mt-0">
        <ByPriceContent
          broker={broker}
          underlying={underlying}
          expiry={expiry}
          product={product}
          quantity={quantity}
          qtyValue={qtyValue}
          qtyMode={qtyMode}
          lotSize={lotSize}
          onQtyChange={setQtyValue}
          onToggleQtyMode={toggleQtyMode}
          sharedControls={sharedControls}
        />
      </TabsContent>

      {/* ── By Chain ─────────────────────────────────────────────────── */}
      <TabsContent value="chain" className="mt-0 space-y-4">
        {sharedControls}

        <ByChainTab
          broker={broker}
          underlying={underlying}
          expiry={expiry}
          product={product}
          quantity={quantity}
          isActive={activeTab === "chain"}
          qtyValue={qtyValue}
          qtyMode={qtyMode}
          lotSize={lotSize}
          onQtyChange={setQtyValue}
          onToggleMode={toggleQtyMode}
        />
      </TabsContent>
    </Tabs>
  );
}

// ── By Price tab — full self-contained layout ────────────────────────────────

interface ByPriceContentProps {
  broker: "upstox" | "zerodha";
  underlying: string;
  expiry: string;
  product: "I" | "D";
  quantity: number;
  qtyValue: string;
  qtyMode: QtyMode;
  lotSize: number;
  onQtyChange: (v: string) => void;
  onToggleQtyMode: () => void;
  sharedControls: ReactNode;
}

function ByPriceContent({
  broker, underlying, expiry, product, quantity,
  qtyValue, qtyMode, lotSize, onQtyChange, onToggleQtyMode,
  sharedControls,
}: ByPriceContentProps) {
  const [price, setPrice]   = useState("");
  const [direction, setDir] = useState<Direction>("Sell");
  const [acting, setActing] = useState<ActionType | null>(null);

  const isBuy  = direction === "Buy";
  const accent = isBuy
    ? { toggle: "bg-green-600" }
    : { toggle: "bg-red-600"   };

  async function execute(action: ActionType) {
    const targetPremium = parseFloat(price);
    if (!targetPremium || targetPremium <= 0) { toast.error("Enter a valid target premium"); return; }
    if (!expiry) { toast.error("Select an expiry"); return; }

    const underlyingKey = UNDERLYING_KEYS[underlying];
    setActing(action);
    try {
      const base = { underlyingKey, expiry, targetPremium, qty: quantity, transactionType: direction, product };
      const orders: Promise<void>[] = [];
      if (action === "CE" || action === "BOTH") orders.push(placeOrderByPrice(broker, { ...base, instrumentType: "CE" }));
      if (action === "PE" || action === "BOTH") orders.push(placeOrderByPrice(broker, { ...base, instrumentType: "PE" }));

      await Promise.all(orders);
      toast.success("Order placed successfully");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-5">
      {sharedControls}

      {/* Quantity + Target Premium + Direction toggle */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Quantity</p>
          <QtyInput
            value={qtyValue}
            mode={qtyMode}
            lotSize={lotSize}
            onChange={onQtyChange}
            onToggleMode={onToggleQtyMode}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Target Premium</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="pl-7 h-9 text-sm"
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Direction</p>
          <div className="flex h-9 items-center">
            <button
              onClick={() => setDir((d) => d === "Buy" ? "Sell" : "Buy")}
              className={cn(
                "relative flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors duration-200",
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
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-2">
        {(["CE", "PE", "BOTH"] as ActionType[]).map((action) => {
          const Icon =
            action === "BOTH" ? ArrowUpDown
            : action === "CE" ? (isBuy ? TrendingUp : TrendingDown)
            : (isBuy ? TrendingDown : TrendingUp);
          return (
            <Button
              key={action}
              disabled={acting !== null || !qtyValue || !price || parseFloat(price) <= 0}
              onClick={() => execute(action)}
              className={cn(
                "h-11 font-semibold text-sm transition-all gap-1.5",
                isBuy ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white",
              )}
            >
              {acting === action ? (
                <><Zap className="size-3.5 animate-pulse" />Placing…</>
              ) : (
                <><Icon className="size-4" />{action === "BOTH" ? "CE + PE" : action}</>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
