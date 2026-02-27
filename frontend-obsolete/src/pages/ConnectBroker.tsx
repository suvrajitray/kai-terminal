import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface BrokerCardProps {
  name: string;
  description: string;
  color: string;
  onConnect: () => void;
}

const BrokerCard: React.FC<BrokerCardProps> = ({
  name,
  description,
  color,
  onConnect,
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Card className="bg-[#111827] border border-gray-800 rounded-2xl shadow-lg">
        <CardContent className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{name}</h2>
            <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
              DISCONNECTED
            </span>
          </div>

          <p className="text-sm text-gray-400">{description}</p>

          <Button
            onClick={onConnect}
            className={`mt-4 rounded-xl text-white ${color}`}
          >
            Connect {name}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default function App() {
  return (
    <div className="min-h-screen bg-[#0b0f14] text-gray-200 flex items-center justify-center">
      <div className="w-full max-w-5xl px-6">
        <h1 className="text-3xl font-semibold mb-2">Trading Terminal</h1>
        <p className="text-gray-400 mb-10">
          Connect your broker to start trading
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <BrokerCard
            name="Zerodha"
            description="Kite Connect based trading, positions, and live market data."
            color="bg-blue-600 hover:bg-blue-700"
            onConnect={() =>
              (window.location.href = "http://localhost:5000/auth/zerodha")
            }
          />

          <BrokerCard
            name="Upstox"
            description="Upstox API based trading, portfolio and real-time feeds."
            color="bg-green-600 hover:bg-green-700"
            onConnect={() =>
              (window.location.href = "http://localhost:5000/auth/upstox")
            }
          />
        </div>
      </div>
    </div>
  );
}
