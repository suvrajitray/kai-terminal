import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useBrokerStore } from "@/stores/broker-store";
import { isTokenExpired } from "@/lib/token-utils";
import { Button } from "@/components/ui/button";

interface CopyTokenButtonProps {
  brokerId?: string;
}

export function CopyTokenButton({ brokerId = "upstox" }: CopyTokenButtonProps) {
  const token = useBrokerStore((s) => s.getCredentials(brokerId)?.accessToken);
  const [copied, setCopied] = useState(false);

  if (!token || isTokenExpired(token)) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleCopy}
      title="Copy access token"
    >
      {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
    </Button>
  );
}
