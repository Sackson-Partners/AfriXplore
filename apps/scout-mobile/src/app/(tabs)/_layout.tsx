import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      tabBarStyle: { backgroundColor: '#0a0f1e', borderTopColor: '#1f2937' },
      tabBarActiveTintColor: '#F59E0B',
      tabBarInactiveTintColor: '#6B7280',
      headerShown: false,
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="report" options={{ title: 'Report', tabBarLabel: 'Report' }} />
      <Tabs.Screen name="reports" options={{ title: 'My Reports', tabBarLabel: 'Reports' }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarLabel: 'Earnings' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: 'Profile' }} />
    </Tabs>
  );
}
