import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Zap, TrendingUp, TrendingDown, ArrowUpDown, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QuickTradeQtyInput, type QtyMode } from "./quick-trade-qty-input";
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
import { placeOrderByOptionPrice } from "@/services/trading-api";
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
  const [underlying, setUnderlying] = useState("NIFTY");
  const [expiry, setExpiry]         = useState("");
  const [qtyValue, setQtyValue]     = useState("");
  const [qtyMode, setQtyMode]       = useState<QtyMode>("qty");
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
      {/* Underlying */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Underlying</Label>
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
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Expiry</Label>
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
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Product</Label>
          <div className="flex gap-1.5">
            {(["I", "D"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProduct(p)}
                className={cn(
                  "flex-1 rounded py-1.5 text-xs font-semibold transition-colors border",
                  product === p
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {p === "I" ? "Intraday" : "Delivery"}
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

        {/* Qty row */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quantity</Label>
          <QuickTradeQtyInput
            value={qtyValue}
            mode={qtyMode}
            lotSize={lotSize}
            onChange={setQtyValue}
            onToggleMode={toggleQtyMode}
          />
        </div>

        <ByChainTab
          underlying={underlying}
          expiry={expiry}
          product={product}
          quantity={quantity}
          isActive={activeTab === "chain"}
        />
      </TabsContent>
    </Tabs>
  );
}

// ── By Price tab — full self-contained layout ────────────────────────────────

interface ByPriceContentProps {
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
  underlying, expiry, product, quantity,
  qtyValue, qtyMode, lotSize, onQtyChange, onToggleQtyMode,
  sharedControls,
}: ByPriceContentProps) {
  const [price, setPrice]   = useState("");
  const [direction, setDir] = useState<Direction>("Sell");
  const [acting, setActing] = useState<ActionType | null>(null);

  const isBuy = direction === "Buy";

  async function execute(action: ActionType) {
    const targetPremium = parseFloat(price);
    if (!targetPremium || targetPremium <= 0) { toast.error("Enter a valid target premium"); return; }
    if (!expiry) { toast.error("Select an expiry"); return; }

    const underlyingKey = UNDERLYING_KEYS[underlying];
    const orders: Promise<void>[] = [];
    const add = (optionType: "CE" | "PE") =>
      orders.push(placeOrderByOptionPrice({ underlyingKey, expiryDate: expiry, optionType, targetPremium, priceSearchMode: "Nearest", quantity, transactionType: direction, product }));

    if (action === "CE")   add("CE");
    if (action === "PE")   add("PE");
    if (action === "BOTH") { add("CE"); add("PE"); }

    setActing(action);
    try {
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

      {/* Target Premium + Quantity */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Target Premium</Label>
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
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quantity</Label>
          <QuickTradeQtyInput
            value={qtyValue}
            mode={qtyMode}
            lotSize={lotSize}
            onChange={onQtyChange}
            onToggleMode={onToggleQtyMode}
          />
        </div>
      </div>

      <div className="h-px bg-border/40" />

      {/* Buy / Sell toggle */}
      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 p-1">
        <button
          onClick={() => setDir("Buy")}
          className={cn(
            "flex-1 rounded-md py-2 text-sm font-semibold transition-all",
            isBuy ? "bg-green-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Buy
        </button>
        <button
          onClick={() => setDir("Sell")}
          className={cn(
            "flex-1 rounded-md py-2 text-sm font-semibold transition-all",
            !isBuy ? "bg-red-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Sell
        </button>
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
                <><Icon className="size-4" />{action === "BOTH" ? "Both" : action}</>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
