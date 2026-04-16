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
    if (!token || !isActive) {
      if (inTabs) router.replace('/login');
    } else {
      if (!inTabs) router.replace('/(tabs)/');
    }
  }, [token, isActive, segments, isHydrated]);

  // Show blank dark screen while hydrating to avoid flash
  if (!isHydrated) {
    return <View className="flex-1 bg-zinc-950" />;
  }

  return <Slot />;
}
