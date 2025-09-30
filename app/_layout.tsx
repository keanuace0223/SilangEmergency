import * as NavigationBar from 'expo-navigation-bar';
import { Stack, usePathname } from "expo-router";
import React, { useEffect } from "react";
import { UserProvider } from '../src/context/UserContext';
import './global.css';

export default function RootLayout() {
  const pathname = usePathname();

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

  return (
      <UserProvider>
        <Stack screenOptions={{headerShown: false}}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }}/>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }}/>
          <Stack.Screen name="Reports/[id]" options={{ headerShown: false }}/>
        </Stack>
      </UserProvider>
  )
}