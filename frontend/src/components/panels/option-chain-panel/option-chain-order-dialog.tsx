import { useState } from "react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { placeOrder } from "@/services/trading-api";
import { useBrokerStore } from "@/stores/broker-store";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { getLotSize } from "@/lib/lot-sizes";
import { BROKERS } from "@/lib/constants";
import { isBrokerTokenExpired } from "@/lib/token-utils";

export interface OrderIntent {
  instrumentKey: string;   // Upstox key e.g. "NSE_FO|37590"
  side: "CE" | "PE";
  transactionType: "Buy" | "Sell";
  ltp: number;
  strike: number;
  underlying: string;      // e.g. "NIFTY"
}

interface Props {
  intent: OrderIntent | null;
  onClose: () => void;
}

export function OptionChainOrderDialog({ intent, onClose }: Props) {
  const credentials       = useBrokerStore((s) => s.credentials);
  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);

  const activeBrokers = BROKERS.filter(
    (b) => !isBrokerTokenExpired(b.id, credentials[b.id]?.accessToken),
  );

  const [broker, setBroker]   = useState<string>(() => activeBrokers[0]?.id ?? "upstox");
  const [lots, setLots]       = useState(1);
  const [product, setProduct] = useState("Intraday");
  const [placing, setPlacing] = useState(false);

  if (!intent) return null;

  const lotSize  = getLotSize(intent.underlying);
  const qty      = lots * lotSize;
  const contract = getByInstrumentKey(intent.instrumentKey);

  async function handlePlace() {
    setPlacing(true);
    try {
      let token = intent!.instrumentKey;
      if (broker === "zerodha" && contract?.contract.zerodhaToken) {
        token = contract.contract.zerodhaToken;
      }
      await placeOrder(token, qty, intent!.transactionType, product, "market", undefined, broker);
      toast.success(`${intent!.transactionType} order placed`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPlacing(false);
    }
  }

  const isBuy  = intent.transactionType === "Buy";
  const label  = `${intent.transactionType} ${intent.underlying} ${intent.strike.toLocaleString("en-IN")} ${intent.side}`;

  return (
    <Dialog open={!!intent} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className={cn("text-base", isBuy ? "text-blue-400" : "text-red-400")}>
            {label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {/* LTP reference */}
          <p className="text-xs text-muted-foreground">
            LTP <span className="font-mono font-medium text-foreground">{intent.ltp.toFixed(2)}</span>
            {" · "}Market order · {qty} qty ({lots} lot{lots > 1 ? "s" : ""})
          </p>

          {/* Broker */}
          {activeBrokers.length > 1 && (
            <div className="space-y-1">
              <Label className="text-xs">Broker</Label>
              <Select value={broker} onValueChange={setBroker}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeBrokers.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs capitalize">{b.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Lots */}
          <div className="space-y-1">
            <Label className="text-xs">Lots (1 lot = {lotSize})</Label>
            <Input
              type="number"
              min={1}
              value={lots}
              onChange={(e) => setLots(Math.max(1, parseInt(e.target.value) || 1))}
              className="h-8 text-xs"
            />
          </div>

          {/* Product */}
          <div className="space-y-1">
            <Label className="text-xs">Product</Label>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Intraday" className="text-xs">Intraday (MIS)</SelectItem>
                <SelectItem value="Delivery" className="text-xs">NRML</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Place button */}
          <Button
            className={cn("w-full", isBuy ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")}
            onClick={handlePlace}
            disabled={placing}
          >
            {placing ? "Placing…" : `${intent.transactionType} ${qty} qty`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
