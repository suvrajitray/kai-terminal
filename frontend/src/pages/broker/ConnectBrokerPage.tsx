import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ConnectBrokerPage() {
  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-2">Connect Broker</h1>
      <p className="text-gray-400 mb-8">Choose a broker to continue</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        <Card className="bg-[#111827] border border-gray-800 rounded-2xl">
          <CardContent className="p-6">
            <h2 className="text-lg font-medium mb-2">Zerodha</h2>
            <p className="text-sm text-gray-400 mb-4">Kite Connect API</p>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() =>
                (window.location.href = "http://localhost:5000/auth/zerodha")
              }
            >
              Connect Zerodha
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#111827] border border-gray-800 rounded-2xl">
          <CardContent className="p-6">
            <h2 className="text-lg font-medium mb-2">Upstox</h2>
            <p className="text-sm text-gray-400 mb-4">Upstox Trading API</p>
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() =>
                (window.location.href = "http://localhost:5000/auth/upstox")
              }
            >
              Connect Upstox
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
