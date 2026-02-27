import { motion } from "motion/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BrokerInfo } from "@/types";

interface BrokerCardProps {
  broker: BrokerInfo;
}

export function BrokerCard({ broker }: BrokerCardProps) {
  return (
    <motion.div className="h-full" whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <Card className="flex h-full flex-col">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className="size-3 rounded-full"
              style={{ backgroundColor: broker.color }}
            />
            <CardTitle className="text-lg">{broker.name}</CardTitle>
          </div>
          <CardDescription className="pt-1">{broker.description}</CardDescription>
        </CardHeader>
        <CardContent className="mt-auto space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {broker.features.map((feature) => (
              <Badge key={feature} variant="secondary" className="text-xs">
                {feature}
              </Badge>
            ))}
          </div>
          <Button className="w-full" variant={broker.connected ? "secondary" : "default"}>
            {broker.connected ? "Connected" : "Connect"}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
