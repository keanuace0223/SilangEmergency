import * as NavigationBar from 'expo-navigation-bar';
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from "react";
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { SettingsProvider } from '../src/context/SettingsContext';
import { SyncProvider } from '../src/context/SyncContext';
import { UserProvider } from '../src/context/UserContext';
import './global.css';

// Prevent the splash screen from auto-hiding until auth/session is resolved
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const pathname = usePathname();
  const { isLoading, session } = useAuth();

  useEffect(() => {
    // Default nav bar background and icons
    (async () => {
      try {
        await NavigationBar.setBackgroundColorAsync('#FFFFFF');
        await NavigationBar.setButtonStyleAsync('dark');
        // Ensure navbar is not overlaying content and insets the layout
        await NavigationBar.setBehaviorAsync('inset-swipe');
        await NavigationBar.setPositionAsync('relative');
        // Force it visible with solid background
        // @ts-ignore newer SDKs
        if (NavigationBar.setVisibilityAsync) {
          // @ts-ignore
          await NavigationBar.setVisibilityAsync('visible');
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    // Adapt Android navigation bar background to screen background
    // Dashboard uses gray-50; others default to white
    const DASHBOARD_BG = '#F9FAFB'; // tailwind gray-50
    const DEFAULT_BG = '#FFFFFF';

    const isDashboard = pathname?.includes('/(tabs)/index') || pathname === '/(tabs)';
    const navColor = isDashboard ? DASHBOARD_BG : DEFAULT_BG;

    (async () => {
      try {
        await NavigationBar.setBackgroundColorAsync(navColor);
        await NavigationBar.setButtonStyleAsync('dark');
        await NavigationBar.setBehaviorAsync('inset-swipe');
        await NavigationBar.setPositionAsync('relative');
        // @ts-ignore newer SDKs
        if (NavigationBar.setVisibilityAsync) {
          // @ts-ignore
          await NavigationBar.setVisibilityAsync('visible');
        }
      } catch {}
    })();
  }, [pathname]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{headerShown: false}}>
      {session ? (
        <>
          <Stack.Screen name="(admin)" options={{ headerShown: false }}/>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }}/>
        </>
      ) : (
        <Stack.Screen name="(auth)" options={{ headerShown: false }}/>
      )}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <UserProvider>
          <SyncProvider>
            <RootNavigator />
          </SyncProvider>
        </UserProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}