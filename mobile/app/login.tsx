import { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../stores/auth-store';
import { API_BASE_URL } from '../constants';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const setToken = useAuthStore((s) => s.setToken);

  const handleLogin = async () => {
    const url = `${API_BASE_URL}/auth/google?platform=mobile`;
    const result = await WebBrowser.openAuthSessionAsync(url, 'kaiterminal://auth/callback');
    // iOS: token comes back in the return value (ASWebAuthenticationSession)
    if (result.type === 'success') {
      const { queryParams } = Linking.parse(result.url);
      if (queryParams?.token) await setToken(queryParams.token as string);
    }
  };

  useEffect(() => {
    // Android: token comes via Linking event (cold-start deep link)
    const sub = Linking.addEventListener('url', async ({ url }) => {
      const { queryParams } = Linking.parse(url);
      if (queryParams?.token) await setToken(queryParams.token as string);
    });
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View className="flex-1 bg-zinc-950 items-center justify-center gap-6 p-8">
      <Text className="text-white text-3xl font-bold tracking-tight">KAI Terminal</Text>
      <Text className="text-zinc-400 text-sm text-center">Professional options trading terminal</Text>
      <TouchableOpacity
        onPress={handleLogin}
        className="bg-violet-600 px-8 py-3 rounded-xl w-full items-center"
      >
        <Text className="text-white font-semibold text-base">Sign in with Google</Text>
      </TouchableOpacity>
    </View>
  );
}
