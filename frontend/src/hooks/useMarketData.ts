import { useEffect, useRef, useState } from "react";

type Tick = {
  symbol: string;
  ltp: number;
};

export function useMarketData(symbols: string[]) {
  const [ticks, setTicks] = useState<Record<string, number>>({});
  const intervalRef = useRef<number>();

  useEffect(() => {
    // 🔧 MOCK TICK GENERATOR (DEV ONLY)
    intervalRef.current = window.setInterval(() => {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];

      const prev = ticks[symbol] ?? 150;
      const change = (Math.random() - 0.5) * 5;
      const ltp = +(prev + change).toFixed(2);

      setTicks((prevTicks) => ({
        ...prevTicks,
        [symbol]: Math.max(1, ltp),
      }));
    }, 1000);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [symbols.join(",")]);

  return ticks;
}
