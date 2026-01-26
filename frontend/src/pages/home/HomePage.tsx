import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
      <p className="text-gray-400 mb-8">Welcome to your trading terminal</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#111827] border border-gray-800 rounded-2xl">
          <CardContent className="p-6">
            <h2 className="text-lg font-medium mb-2 text-gray-300">
              Connect Broker
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Login with Zerodha or Upstox
            </p>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => navigate("/connect-broker")}
            >
              Go to Connect
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#111827] border border-gray-800 rounded-2xl">
          <CardContent className="p-6">
            <h2 className="text-lg font-medium mb-2 text-gray-300">
              Positions
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              View open positions & P&L
            </p>
            <Button
              variant="secondary"
              className="w-full"
            >
              View Positions
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#111827] border border-gray-800 rounded-2xl">
          <CardContent className="p-6">
            <h2 className="text-lg font-medium mb-2 text-gray-300">Orders</h2>
            <p className="text-sm text-gray-400 mb-4">Manage all orders</p>
            <Button
              variant="secondary"
              className="w-full"
            >
              View Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
