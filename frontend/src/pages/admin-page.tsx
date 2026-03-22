import { useEffect, useState } from "react";
import { Eye, EyeOff, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalyticsToken, saveAnalyticsToken } from "@/services/admin-api";
import { toast } from "sonner";

export function AdminPage() {
  const [token, setToken]       = useState("");
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    getAnalyticsToken()
      .then(setToken)
      .catch(() => toast.error("Failed to load analytics token"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await saveAnalyticsToken(token);
      toast.success("Analytics token saved");
    } catch {
      toast.error("Failed to save analytics token");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          System-wide configuration. Changes apply to all users.
        </p>
      </div>

      <Card className="max-w-xl border-border/40 bg-muted/10">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Upstox Analytics Token</CardTitle>
          </div>
          <CardDescription>
            Read-only token used to fetch option contract master data (instrument list, strikes,
            expiries). Obtain from the Upstox Developer Portal under Analytics Token.
            Updating this token clears the contract cache on the next request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="analytics-token">Token</Label>
            <div className="relative">
              <Input
                id="analytics-token"
                type={revealed ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={loading ? "Loading…" : "Paste analytics token here"}
                disabled={loading}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button onClick={handleSave} disabled={loading || saving} size="sm">
            <Save className="mr-2 size-4" />
            {saving ? "Saving…" : "Save Token"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
