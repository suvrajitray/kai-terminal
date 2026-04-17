import '../global.css';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../stores/auth-store';

export default function RootLayout() {
  const { token, isActive, isHydrated, hydrate } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => { hydrate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isHydrated) return; // Wait for SecureStore read before navigating
    const inTabs = segments[0] === '(tabs)';
    const inConnectBrokers = segments[0] === 'connect-brokers';
    if (!token || !isActive) {
      if (inTabs || inConnectBrokers) router.replace('/login');
    } else {
      // Allow connect-brokers without redirecting to tabs
      if (!inTabs && !inConnectBrokers) router.replace('/(tabs)');
    }
  }, [token, isActive, segments, isHydrated]);

  // Show blank dark screen while hydrating to avoid flash
  if (!isHydrated) {
    return <View className="flex-1 bg-zinc-950" />;
  }

  return <Slot />;
}
