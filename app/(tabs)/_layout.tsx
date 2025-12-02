import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import { DeviceEventEmitter, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScaledText from '../../components/ScaledText';
import { useUser } from '../../src/context/UserContext';

const TabsLayout = () => {
  const TAB_BAR_SHADOW = {
    backgroundColor: '#fff',
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  };

  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const TAB_BAR_HEIGHT = 64;

  // Check if user is admin via known admin userids and/or email aliases
  const adminUserIds = ['admin1', 'admin2', 'admin3'];
  const adminEmails = adminUserIds.map((u) => `${u}@login.local`);
  const isAdmin = Boolean(
    (user?.userid && adminUserIds.includes(user.userid)) ||
    (user?.email && adminEmails.includes(user.email))
  );

  // Custom pill-style tab bar with centered add button
  const CustomTabBar = ({ state, descriptors, navigation }: any) => {
    // Hide tab bar when on create-report screen
    const currentRoute = state.routes[state.index]?.name;
    if (currentRoute === 'create-report') {
      return null;
    }

    const activeColor = '#4A90E2';
    const inactiveColor = '#8E8E93';
    const iconMap: Record<string, any> = {
      index: 'home',
      reports: 'newspaper',
      drafts: 'documents',
      profile: 'person',
    };

    // Split tabs into left and right groups for the centered button
    const leftTabs = ['index', 'reports'];
    const rightTabs = ['drafts', 'profile'];

    const renderTab = (route: any) => {
      const index = state.routes.findIndex((r: any) => r.key === route.key);
      const isFocused = state.index === index;
      const color = isFocused ? activeColor : inactiveColor;
      const onPress = () => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      };
      const options = descriptors[route.key]?.options || {};
      const label = (options.title as string) || (options.tabBarLabel as string) || route.name;
      
      return (
        <TouchableOpacity
          key={route.key}
          onPress={onPress}
          activeOpacity={0.85}
          className="flex-1 h-12 mx-1 rounded-2xl items-center justify-center"
          style={{
            backgroundColor: isFocused ? '#E8F1FD' : 'transparent',
          }}
        >
          <Ionicons name={iconMap[route.name] as any} size={22} color={color} />
          <ScaledText baseSize={11} style={{ marginTop: 4, fontWeight: '700', color }}>{label}</ScaledText>
        </TouchableOpacity>
      );
    };

    return (
      <View
        className="absolute left-0 right-0 items-center"
        style={{
          bottom: Math.max(insets.bottom + 6, 10),
          height: TAB_BAR_HEIGHT,
        }}
        pointerEvents="box-none"
      >
        <View
          className="flex-row items-center justify-between px-2 rounded-3xl"
          style={{
            ...TAB_BAR_SHADOW,
            height: '100%',
            width: '92%',
            maxWidth: 640,
            minWidth: 320,
          }}
        >
          {/* Left side tabs */}
          <View className="flex-row flex-1">
            {leftTabs.map((tabName) => {
              const route = state.routes.find((r: any) => r.name === tabName);
              return route ? renderTab(route) : null;
            })}
          </View>

          {/* Centered Add Report Button */}
          {!isAdmin && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                // Emit event for the current tab to handle add report
                if (pathname?.endsWith('/index')) {
                  DeviceEventEmitter.emit('OPEN_HOME_ADD');
                } else if (pathname?.includes('/reports')) {
                  DeviceEventEmitter.emit('OPEN_REPORTS_ADD');
                } else if (pathname?.includes('/drafts')) {
                  DeviceEventEmitter.emit('OPEN_DRAFTS_ADD');
                } else if (pathname?.includes('/profile')) {
                  DeviceEventEmitter.emit('OPEN_PROFILE_ADD');
                } else {
                  // Fallback to home
                  DeviceEventEmitter.emit('OPEN_HOME_ADD');
                }
              }}
              className="w-14 h-14 rounded-full items-center justify-center mx-2"
              style={{
                backgroundColor: '#4A90E2',
                shadowColor: '#4A90E2',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 12,
                transform: [{ translateY: -16 }], // Elevate the button more
              }}
            >
              <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Right side tabs */}
          <View className="flex-row flex-1">
            {rightTabs.map((tabName) => {
              const route = state.routes.find((r: any) => r.name === tabName);
              return route ? renderTab(route) : null;
            })}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
    <Tabs 
    tabBar={(props) => <CustomTabBar {...props} />}
    screenOptions={{
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: '#8E8E93',
        headerShown: false,
    }}>
          <Tabs.Screen
            name="index"
            options={{ title: 'Home' }}
          />
          <Tabs.Screen
            name="reports"
            options={{ title: 'Reports' }}
          />
          <Tabs.Screen
            name="drafts"
            options={{ title: 'Drafts' }}
          />
          <Tabs.Screen
            name="profile"
            options={{ title: 'Profile' }}
          />
          <Tabs.Screen
            name="create-report"
            options={{
              href: null,
              headerShown: false,
            }}
          />
      </Tabs>
    </View>
  )
}

export default TabsLayout;