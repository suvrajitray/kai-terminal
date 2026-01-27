import { usePnlStore } from "@/store/pnlStore";
import { useRiskEngine } from "@/hooks/useRiskEngine";

export default function PnlBar() {
  const { totalPnl, mtmStopLoss, setMtmStopLoss, trailing, setTrailing } =
    usePnlStore();

  const isProfit = totalPnl >= 0;

  const handleExitAll = () => {
    alert("EXIT ALL (wire broker API here)");
  };

  // 🔥 auto risk engine
  useRiskEngine(handleExitAll);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50
      ${isProfit ? "bg-green-900/90" : "bg-red-900/90"}
      backdrop-blur border-t border-black`}
    >
      <div className="px-6 py-2 flex flex-col gap-2 text-xs text-white">
        {/* ROW 1 */}
        <div className="flex items-center justify-between gap-4">
          <div>
            Total P&amp;L:&nbsp;
            <span
              className={`font-semibold ${
                isProfit ? "text-green-300" : "text-red-300"
              }`}
            >
              {totalPnl.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span>MTM SL</span>
            <input
              type="number"
              value={mtmStopLoss}
              onChange={(e) => setMtmStopLoss(+e.target.value)}
              className="w-24 bg-black/40 border border-gray-700 rounded px-2 py-0.5"
            />
          </div>

          <button
            onClick={handleExitAll}
            className="px-3 py-1 text-xs font-semibold rounded
            bg-black text-white hover:bg-gray-800 transition"
          >
            EXIT ALL
          </button>
        </div>

        {/* ROW 2 – TRAILING SL */}
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={trailing.enabled}
              onChange={(e) => setTrailing({ enabled: e.target.checked })}
            />
            TSL
          </label>

          <Input
            label="Activate At"
            value={trailing.activateAt}
            onChange={(v) => setTrailing({ activateAt: v })}
          />

          <Input
            label="Lock Profit At"
            value={trailing.lockAt}
            onChange={(v) => setTrailing({ lockAt: v })}
          />

          <Input
            label="When Profit +"
            value={trailing.profitStep}
            onChange={(v) => setTrailing({ profitStep: v })}
          />

          <Input
            label="Increase TSL by"
            value={trailing.tslStep}
            onChange={(v) => setTrailing({ tslStep: v })}
          />
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-300">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-20 bg-black/40 border border-gray-700 rounded px-1 py-0.5"
      />
    </div>
  );
}
