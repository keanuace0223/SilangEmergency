import * as NavigationBar from 'expo-navigation-bar';
import { Stack, usePathname } from "expo-router";
import React, { useEffect } from "react";
import { UserProvider } from '../src/context/UserContext';
import './global.css';

export default function RootLayout() {
  const pathname = usePathname();

  useEffect(() => {
    // Default nav bar background and icons
    NavigationBar.setBackgroundColorAsync('#FFFFFF'); 
    NavigationBar.setButtonStyleAsync('dark');
  }, []);

  useEffect(() => {
    // Adapt nav bar per route (light theme only)
    // Use white on main tabs and auth; darker where needed in the future
    const lightBg = '#FFFFFF';
    const darkBg = '#0B1220';
    const isLight = true; // app uses light theme now

    const currentColor = isLight ? lightBg : darkBg;
    NavigationBar.setBackgroundColorAsync(currentColor);
    NavigationBar.setButtonStyleAsync(isLight ? 'dark' : 'light');
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