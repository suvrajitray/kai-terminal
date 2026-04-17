import { useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { BROKERS, UPSTOX_OAUTH_URL, ZERODHA_OAUTH_URL } from '@/lib/constants'
import { useBrokerStore } from '@/stores/broker-store'
import { saveBrokerCredential } from '@/services/broker-api'
import { isBrokerTokenExpired, useCountdownToEightAmIst } from '@/lib/token-utils'
import { toast } from '@/lib/toast'
import type { BrokerInfo } from '@/types'

function getStatus(
  brokerId: string,
  isConnected: boolean,
  isAuthenticated: boolean,
  token: string | undefined,
): 'active' | 'needs-auth' | 'not-connected' {
  if (isConnected && isAuthenticated && !isBrokerTokenExpired(brokerId, token)) return 'active'
  if (isConnected) return 'needs-auth'
  return 'not-connected'
}

function StatusBadge({ status }: { status: 'active' | 'needs-auth' | 'not-connected' }) {
  if (status === 'active') {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
        Active
      </Badge>
    )
  }
  if (status === 'needs-auth') {
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">
        Needs Auth
      </Badge>
    )
  }
  return (
    <Badge className="bg-muted/40 text-muted-foreground border-border/40 text-[10px] px-1.5 py-0">
      Not Connected
    </Badge>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Failed to copy')
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}

interface BrokerCardProps {
  broker: BrokerInfo
}

function BrokerCard({ broker }: BrokerCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [saving, setSaving] = useState(false)

  const { isConnected, isAuthenticated, getCredentials, saveCredentials } = useBrokerStore()
  const { isBeforeEight, countdown } = useCountdownToEightAmIst()

  const creds = getCredentials(broker.id)
  const connected = isConnected(broker.id)
  const authenticated = isAuthenticated(broker.id)
  const status = getStatus(broker.id, connected, authenticated, creds?.accessToken)

  const redirectUrl = `${window.location.origin}${broker.redirectPath}`
  const currentApiKey = creds?.apiKey ?? ''
  const webhookUrl = `${window.location.origin}/api/webhooks/${broker.id}/order?apiKey=${currentApiKey || 'YOUR_API_KEY'}`

  function openSheet() {
    setApiKey(creds?.apiKey ?? '')
    setApiSecret(creds?.apiSecret ?? '')
    setSheetOpen(true)
  }

  async function handleSave() {
    if (!apiKey.trim() || !apiSecret.trim()) {
      toast.error('API Key and Secret are required')
      return
    }
    setSaving(true)
    try {
      await saveBrokerCredential(broker.id, apiKey.trim(), apiSecret.trim())
      saveCredentials(broker.id, {
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
        redirectUrl,
        accessToken: creds?.accessToken,
      })
      toast.success(`${broker.name} credentials saved`)
      setSheetOpen(false)
    } catch {
      toast.error(`Failed to save ${broker.name} credentials`)
    } finally {
      setSaving(false)
    }
  }

  function handleAuthenticate() {
    const storedKey = creds?.apiKey
    if (!storedKey) return

    sessionStorage.setItem("brokerAuthReturnMobile", "1")

    let oauthUrl: string
    if (broker.id === 'upstox') {
      const sep = UPSTOX_OAUTH_URL.includes('?') ? '&' : '?'
      oauthUrl = `${UPSTOX_OAUTH_URL}${sep}api_key=${storedKey}&redirect_uri=${encodeURIComponent(redirectUrl)}`
    } else {
      const sep = ZERODHA_OAUTH_URL.includes('?') ? '&' : '?'
      oauthUrl = `${ZERODHA_OAUTH_URL}${sep}api_key=${storedKey}`
    }
    window.location.href = oauthUrl
  }

  return (
    <>
      <div className="rounded-lg border border-border/40 bg-muted/20 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
          <div className="flex items-center gap-2">
            <span
              className="size-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: broker.color }}
            />
            <span className="font-medium text-sm text-foreground">{broker.name}</span>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Masked API key row */}
        {connected && creds?.apiKey && (
          <div className="px-4 py-2 border-b border-border/20">
            <p className="text-xs text-muted-foreground font-mono">
              API Key: {creds.apiKey.slice(0, 6)}...
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 px-4 py-3">
          {/* Countdown chip */}
          {connected && isBeforeEight && (
            <p className="text-[11px] text-amber-400/80 tabular-nums">
              Available at 08:00 IST &mdash; {countdown}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs border-border/40"
              onClick={openSheet}
            >
              Configure
            </Button>

            {connected && (
              <Button
                size="sm"
                className={cn(
                  'flex-1 h-8 text-xs gap-1',
                  isBeforeEight && 'opacity-50 cursor-not-allowed',
                )}
                disabled={isBeforeEight}
                onClick={handleAuthenticate}
              >
                Authenticate
                <ExternalLink className="size-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Configure Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-xl px-0">
          <SheetHeader className="px-4 pb-2">
            <SheetTitle className="text-base">
              Configure {broker.name}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-4 px-4 pb-4">
            {/* API Key */}
            <div className="space-y-1.5">
              <Label htmlFor={`${broker.id}-api-key`} className="text-xs text-muted-foreground">
                API Key
              </Label>
              <Input
                id={`${broker.id}-api-key`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API Key"
                className="h-9 text-sm"
                autoComplete="off"
              />
            </div>

            {/* API Secret */}
            <div className="space-y-1.5">
              <Label htmlFor={`${broker.id}-api-secret`} className="text-xs text-muted-foreground">
                API Secret
              </Label>
              <Input
                id={`${broker.id}-api-secret`}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Enter API Secret"
                className="h-9 text-sm"
                type="password"
                autoComplete="off"
              />
            </div>

            {/* Redirect URL (read-only) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Redirect URL</Label>
              <div className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-3 h-9">
                <span className="flex-1 text-xs text-muted-foreground font-mono truncate">
                  {redirectUrl}
                </span>
                <CopyButton value={redirectUrl} />
              </div>
            </div>

            {/* Webhook URL (read-only) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Webhook URL</Label>
              <div className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-3 h-9">
                <span className="flex-1 text-xs text-muted-foreground font-mono truncate">
                  {webhookUrl}
                </span>
                <CopyButton value={webhookUrl} />
              </div>
            </div>

            {/* Save */}
            <Button
              className="w-full h-9 text-sm mt-1"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Credentials'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export function MobileBrokersPage() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="mb-1">
        <h1 className="text-base font-semibold text-foreground">Brokers</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Connect and authenticate your broker accounts.
        </p>
      </div>

      {BROKERS.map((broker) => (
        <BrokerCard key={broker.id} broker={broker} />
      ))}
    </div>
  )
}
