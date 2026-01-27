import AppLayout from "@/components/layout/AppLayout";
import { useMarketData } from "@/hooks/useMarketData";
import { getBlinkClass } from "@/utils/pnlBlink";
import { useEffect, useRef } from "react";
import { usePnlStore } from "@/store/pnlStore";

type Position = {
  symbol: string;
  qty: number;
  buyAvg: number;
  sellAvg: number;
};

const positions: Position[] = [
  {
    symbol: "NIFTY24JAN18000CE",
    qty: 50,
    buyAvg: 120,
    sellAvg: 0,
  },
  {
    symbol: "BANKNIFTY24JAN42000PE",
    qty: -25,
    buyAvg: 0,
    sellAvg: 210,
  },
];

export default function PositionsPage() {
  const symbols = positions.map((p) => p.symbol);
  const ticks = useMarketData(symbols);

  const prevLtpRef = useRef<Record<string, number>>({});

  const rows = positions.map((p) => {
    const ltp = ticks[p.symbol] ?? 0;
    const avg = p.qty > 0 ? p.buyAvg : p.sellAvg;
    const pnl = (ltp - avg) * p.qty;

    const blinkClass = getBlinkClass(prevLtpRef.current[p.symbol], ltp);

    prevLtpRef.current[p.symbol] = ltp;

    return { ...p, ltp, pnl, blinkClass };
  });

  const totalPnl = rows.reduce((s, r) => s + r.pnl, 0);
  const setTotalPnl = usePnlStore((s) => s.setTotalPnl);

  useEffect(() => {
    setTotalPnl(totalPnl);
  }, [totalPnl]);

  return (
    <AppLayout>
      <h1 className="text-xl font-semibold mb-4">Positions</h1>

      <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0b0f14] text-gray-400">
            <tr>
              <th className="text-left px-4 py-3">Instrument</th>
              <th className="text-right px-4 py-3">Qty</th>
              <th className="text-right px-4 py-3">Avg</th>
              <th className="text-right px-4 py-3">LTP</th>
              <th className="text-right px-4 py-3">P&amp;L</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr
                key={r.symbol}
                className={`border-t border-gray-800 ${r.blinkClass}`}
              >
                <td className="px-4 py-3 text-white">{r.symbol}</td>

                <td
                  className={`px-4 py-3 text-right ${
                    r.qty > 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {r.qty}
                </td>

                <td className="px-4 py-3 text-right">
                  {r.qty > 0 ? r.buyAvg : r.sellAvg}
                </td>

                <td className="px-4 py-3 text-right text-white">
                  {r.ltp.toFixed(2)}
                </td>

                <td
                  className={`px-4 py-3 text-right font-medium ${
                    r.pnl >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {r.pnl.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot className="bg-[#0b0f14] border-t border-gray-800">
            <tr>
              <td className="px-4 py-3 font-medium text-white">Total</td>
              <td colSpan={3}></td>
              <td
                className={`px-4 py-3 text-right font-semibold ${
                  totalPnl >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {totalPnl.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </AppLayout>
  );
}
