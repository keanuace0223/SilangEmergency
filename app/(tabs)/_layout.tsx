import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { DeviceEventEmitter, Linking, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScaledText from '../../components/ScaledText';

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


  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const TAB_BAR_HEIGHT = 64;
  const FLOAT_MARGIN = 20;

  // derive booleans inline in handlers to avoid unused warnings
  // Show FABs on all tabs to avoid path-mismatch issues across devices
  const showFloatingActions = pathname?.startsWith('/(tabs)') === true;

  // Custom pill-style tab bar
  const CustomTabBar = ({ state, descriptors, navigation }: any) => {
    const activeColor = '#4A90E2';
    const inactiveColor = '#8E8E93';
    const iconMap: Record<string, any> = {
      index: 'home',
      reports: 'newspaper',
      drafts: 'documents',
      profile: 'person',
    };

    return (
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: Math.max(insets.bottom + 6, 10),
          height: TAB_BAR_HEIGHT,
          alignItems: 'center',
        }}
        pointerEvents="box-none"
      >
        <View
          style={{
            ...TAB_BAR_SHADOW,
            borderRadius: 32,
            height: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            paddingHorizontal: 8,
            width: '92%',
            maxWidth: 640,
            minWidth: 320,
          }}
        >
          {state.routes.map((route: any, index: number) => {
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
            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  height: TAB_BAR_HEIGHT - 16,
                  marginVertical: 8,
                  marginHorizontal: 4,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isFocused ? '#E8F1FD' : 'transparent',
                }}
              >
                <Ionicons name={iconMap[route.name] as any} size={22} color={color} />
                <ScaledText baseSize={11} style={{ marginTop: 4, fontWeight: '700', color }}>{route.name.charAt(0).toUpperCase() + route.name.slice(1)}</ScaledText>
              </TouchableOpacity>
            );
          })}
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

      </Tabs>

      {showFloatingActions && (
        <>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => Linking.openURL('tel:09356016738')}
            style={{ position: 'absolute', right: 20, bottom: (TAB_BAR_HEIGHT + FLOAT_MARGIN) + insets.bottom + 60, width: 56, height: 56, borderRadius: 28, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', elevation: 8 }}
          >
            <Ionicons name="call" size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (pathname?.endsWith('/index')) {
                DeviceEventEmitter.emit('OPEN_HOME_ADD');
              } else if (pathname?.includes('/reports')) {
                router.push({ pathname: '/(tabs)/reports', params: { openAdd: '1' } })
              } else {
                // For other tabs, default to reports add for now
                router.push({ pathname: '/(tabs)/reports', params: { openAdd: '1' } })
              }
            }}
            style={{ position: 'absolute', right: 20, bottom: (TAB_BAR_HEIGHT + FLOAT_MARGIN) + insets.bottom, width: 56, height: 56, borderRadius: 28, backgroundColor: '#4A90E2', alignItems: 'center', justifyContent: 'center', elevation: 8 }}
          >
            <Ionicons name="add" size={26} color="#fff" />
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}

export default TabsLayout;