import { useEffect, useRef, useState } from "react";
import { fetchMargin, type MarginInstrument } from "@/services/trading-api";

interface MarginEstimate {
  margin: number | null;
  loading: boolean;
}

/**
 * Fetches margin directly for the given instruments (no resolve step).
 * Use this in By Chain tab where instrument keys are already known.
 * Debounced 600 ms. Reacts to changes in instrument keys, quantities, or direction.
 */
export function useDirectMarginEstimate(instruments: MarginInstrument[] | null, broker: "upstox" | "zerodha" = "upstox"): MarginEstimate {
  const [margin, setMargin] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable string key so the effect only fires when something actually changed
  const key = instruments
    ? instruments.map((i) => `${i.instrumentToken}:${i.quantity}:${i.product}:${i.transactionType}`).join("|")
    : null;

  useEffect(() => {
    if (!instruments || instruments.length === 0) {
      setMargin(null);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await fetchMargin(instruments, broker);
        setMargin(result.requiredMargin);
      } catch {
        setMargin(null);
      } finally {
        setLoading(false);
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { margin, loading };
}
