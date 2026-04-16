import '../global.css';
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../stores/auth-store';

export default function RootLayout() {
  const { token, isActive, hydrate } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => { hydrate(); }, []);

  useEffect(() => {
    const inTabs = segments[0] === '(tabs)';
    if (!token || !isActive) {
      if (inTabs) router.replace('/login');
    } else {
      if (!inTabs) router.replace('/(tabs)/');
    }
  }, [token, isActive, segments]);

  return <Slot />;
}
