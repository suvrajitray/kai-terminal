import { useState, useCallback, useEffect } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, ActivityIndicator, AppState, AppStateStatus,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useBrokerStore } from '../stores/broker-store';
import {
  fetchBrokerCredentials,
  exchangeUpstoxToken,
  exchangeZerodhaToken,
  updateBrokerAccessToken,
} from '../services/broker';
import { BROKERS } from '../constants';

WebBrowser.maybeCompleteAuthSession();

// Redirect URIs — register these in your broker developer app (one-time setup)
const UPSTOX_REDIRECT  = 'kaiterminal://broker/upstox/callback';
const ZERODHA_REDIRECT = 'kaiterminal://broker/zerodha/callback';

const UPSTOX_OAUTH_BASE  = 'https://api.upstox.com/v2/login/authorization/dialog';
const ZERODHA_OAUTH_BASE = 'https://kite.zerodha.com/connect/login';

function buildUpstoxUrl(apiKey: string) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: apiKey,
    redirect_uri: UPSTOX_REDIRECT,
  });
  return `${UPSTOX_OAUTH_BASE}?${params.toString()}`;
}

function buildZerodhaUrl(apiKey: string) {
  const params = new URLSearchParams({ v: '3', api_key: apiKey });
  return `${ZERODHA_OAUTH_BASE}?${params.toString()}`;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <View className={`px-2 py-0.5 rounded-full ${active ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
      <Text className={`text-xs font-semibold ${active ? 'text-emerald-400' : 'text-amber-400'}`}>
        {active ? 'Session Active' : 'Needs Auth'}
      </Text>
    </View>
  );
}

export default function ConnectBrokersScreen() {
  const router = useRouter();
  const setCredentials  = useBrokerStore((s) => s.setCredentials);
  const setAccessToken  = useBrokerStore((s) => s.setAccessToken);
  const getCredentials  = useBrokerStore((s) => s.getCredentials);
  const hasCredentials  = useBrokerStore((s) => s.hasCredentials);
  const isSessionActive = useBrokerStore((s) => s.isSessionActive);

  const [loading, setLoading]   = useState(true);
  const [authing, setAuthing]   = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const loadCredentials = useCallback(async () => {
    try {
      const creds = await fetchBrokerCredentials();
      for (const c of creds) {
        setCredentials(c.brokerName, {
          apiKey: c.apiKey,
          apiSecret: c.apiSecret,
          accessToken: c.accessToken,
        });
      }
    } catch {
      // silently fail — store may already have cached data
    } finally {
      setLoading(false);
    }
  }, [setCredentials]);

  useEffect(() => { loadCredentials(); }, [loadCredentials]);

  // Reload when app returns to foreground (user may have authenticated in browser)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') loadCredentials();
    });
    return () => sub.remove();
  }, [loadCredentials]);

  const handleAuth = async (brokerId: string) => {
    const creds = getCredentials(brokerId);
    if (!creds) {
      setError(`No credentials found for ${brokerId}. Set up your broker on the web app first.`);
      return;
    }

    setError(null);
    setAuthing(brokerId);

    try {
      if (brokerId === 'upstox') {
        const authUrl = buildUpstoxUrl(creds.apiKey);
        const result  = await WebBrowser.openAuthSessionAsync(authUrl, UPSTOX_REDIRECT);

        if (result.type === 'success') {
          const { queryParams } = Linking.parse(result.url);
          const code = queryParams?.code as string | undefined;
          if (!code) { setError('No authorization code received from Upstox.'); return; }

          const accessToken = await exchangeUpstoxToken(creds.apiKey, creds.apiSecret, UPSTOX_REDIRECT, code);
          await updateBrokerAccessToken('upstox', accessToken);
          setAccessToken('upstox', accessToken);
        } else if (result.type === 'cancel') {
          setError('Authentication cancelled.');
        }
      } else if (brokerId === 'zerodha') {
        const authUrl = buildZerodhaUrl(creds.apiKey);
        const result  = await WebBrowser.openAuthSessionAsync(authUrl, ZERODHA_REDIRECT);

        if (result.type === 'success') {
          const { queryParams } = Linking.parse(result.url);
          const requestToken = queryParams?.request_token as string | undefined;
          if (!requestToken) { setError('No request token received from Zerodha.'); return; }

          const accessToken = await exchangeZerodhaToken(creds.apiKey, creds.apiSecret, requestToken);
          await updateBrokerAccessToken('zerodha', accessToken);
          setAccessToken('zerodha', accessToken);
        } else if (result.type === 'cancel') {
          setError('Authentication cancelled.');
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Authentication failed.';
      setError(msg);
    } finally {
      setAuthing(null);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator color="#7B2FF7" />
      </View>
    );
  }

  const configuredBrokers = BROKERS.filter((b) => hasCredentials(b.id));

  return (
    <ScrollView className="flex-1 bg-zinc-950">
      <View className="px-4 pt-12 pb-8 gap-5">
        {/* Header */}
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} className="pr-1">
            <Text className="text-violet-400 text-base">← Back</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold flex-1">Connect Brokers</Text>
        </View>

        <Text className="text-zinc-400 text-sm -mt-2">
          Authenticate daily to start live trading. Sessions expire at end of day.
        </Text>

        {/* One-time setup notice */}
        <View className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 gap-3">
          <Text className="text-zinc-300 text-sm font-semibold">One-time Setup Required</Text>
          <Text className="text-zinc-500 text-xs leading-relaxed">
            Register these redirect URIs in your broker's developer app before authenticating:
          </Text>
          <View className="gap-1.5">
            <View className="bg-zinc-800 rounded-lg px-3 py-2">
              <Text className="text-zinc-400 text-[10px] mb-0.5">Upstox → Developer Portal → My Apps → Redirect URL</Text>
              <Text className="text-violet-300 text-xs font-mono" selectable>{UPSTOX_REDIRECT}</Text>
            </View>
            <View className="bg-zinc-800 rounded-lg px-3 py-2">
              <Text className="text-zinc-400 text-[10px] mb-0.5">Zerodha → Kite Connect → Your Apps → Redirect URL</Text>
              <Text className="text-blue-300 text-xs font-mono" selectable>{ZERODHA_REDIRECT}</Text>
            </View>
          </View>
        </View>

        {/* Error banner */}
        {error && (
          <View className="bg-rose-500/15 border border-rose-500/40 rounded-xl px-4 py-3">
            <Text className="text-rose-400 text-sm">{error}</Text>
          </View>
        )}

        {/* Broker cards */}
        {configuredBrokers.length === 0 ? (
          <View className="items-center py-12 gap-3">
            <Text className="text-zinc-500 text-sm text-center">
              No brokers configured yet.{'\n'}Set up your broker credentials on the web app first.
            </Text>
          </View>
        ) : (
          configuredBrokers.map((broker) => {
            const active  = isSessionActive(broker.id);
            const busy    = authing === broker.id;
            return (
              <View key={broker.id}
                className={`rounded-2xl border p-5 gap-4 ${active ? 'border-emerald-500/25 bg-zinc-900' : 'border-amber-500/25 bg-zinc-900'}`}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: broker.color }} />
                    <Text className="text-white text-base font-semibold">{broker.name}</Text>
                  </View>
                  <StatusBadge active={active} />
                </View>

                <TouchableOpacity
                  onPress={() => handleAuth(broker.id)}
                  disabled={busy}
                  className={`py-3 rounded-xl items-center ${busy ? 'bg-zinc-800' : 'bg-violet-600'}`}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#a78bfa" />
                  ) : (
                    <Text className="text-white font-semibold text-sm">
                      {active ? 'Re-authenticate' : 'Authenticate'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* All active → back to dashboard */}
        {configuredBrokers.length > 0 && configuredBrokers.every((b) => isSessionActive(b.id)) && (
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/')}
            className="bg-emerald-600 py-4 rounded-2xl items-center mt-2"
          >
            <Text className="text-white font-bold text-base">All Set — Go to Dashboard</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}
