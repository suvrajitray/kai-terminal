import { useParams, Link, Navigate } from "react-router-dom";
import { motion } from "motion/react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BROKERS } from "@/lib/constants";

export function BrokerRedirectPage() {
  const { brokerId } = useParams<{ brokerId: string }>();
  const broker = BROKERS.find((b) => b.id === brokerId);

  if (!broker) {
    return <Navigate to="/connect-brokers" replace />;
  }

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="w-full max-w-lg">
          <CardHeader>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="flex items-center gap-3"
            >
              <CheckCircle2
                className="size-8 shrink-0"
                style={{ color: broker.color }}
              />
              <CardTitle className="text-xl">Authentication Successful</CardTitle>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <CardDescription className="pt-2 text-sm">
                Successfully connected to{" "}
                <span className="font-medium text-foreground">{broker.name}</span>.
                You can now trade using your {broker.name} account.
              </CardDescription>
            </motion.div>
          </CardHeader>
          <CardContent>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.5 }}
              className="flex gap-3"
            >
              <Button asChild className="flex-1">
                <Link to="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/connect-brokers">Back to Brokers</Link>
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
