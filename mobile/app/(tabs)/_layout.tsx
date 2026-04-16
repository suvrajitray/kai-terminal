import { Tabs } from 'expo-router';
import { Home, LayoutList, Zap, ShieldCheck } from 'lucide-react-native';
import { LivePositionsProvider } from '../../hooks/use-live-positions-context';

export default function TabLayout() {
  return (
    <LivePositionsProvider>
      <Tabs screenOptions={{
        tabBarStyle: { backgroundColor: '#09090b', borderTopColor: '#27272a' },
        tabBarActiveTintColor: '#7B2FF7',
        tabBarInactiveTintColor: '#71717a',
        headerShown: false,
      }}>
        <Tabs.Screen name="index"     options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <Home size={20} color={color} /> }} />
        <Tabs.Screen name="positions" options={{ title: 'Positions',  tabBarIcon: ({ color }) => <LayoutList size={20} color={color} /> }} />
        <Tabs.Screen name="trade"     options={{ title: 'Trade',      tabBarIcon: ({ color }) => <Zap size={20} color={color} /> }} />
        <Tabs.Screen name="protect"   options={{ title: 'Protect',    tabBarIcon: ({ color }) => <ShieldCheck size={20} color={color} /> }} />
      </Tabs>
    </LivePositionsProvider>
  );
}
