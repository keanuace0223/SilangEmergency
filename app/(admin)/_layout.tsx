import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function AdminLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="overview" options={{ title: 'Overview', tabBarIcon: ({ color, size }) => (<Ionicons name="stats-chart" color={color} size={size} />) }} />
      <Tabs.Screen name="users" options={{ title: 'Users', tabBarIcon: ({ color, size }) => (<Ionicons name="people" color={color} size={size} />) }} />
      <Tabs.Screen name="user-reports" options={{ title: 'User Reports', tabBarIcon: ({ color, size }) => (<Ionicons name="document-text" color={color} size={size} />) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => (<Ionicons name="person" color={color} size={size} />) }} />
    </Tabs>
  );
}
