import * as NavigationBar from 'expo-navigation-bar';
import { Stack } from "expo-router";
import React, { useEffect } from "react";
import './global.css';


export default function RootLayout() {

  useEffect(() => {
    // Change nav bar background color
    NavigationBar.setBackgroundColorAsync('#ffffff'); 
    
    // Change button (icon) color
    NavigationBar.setButtonStyleAsync('dark'); // or 'light'
  }, []);




  return <Stack screenOptions={{headerShown: false}}>
    <Stack.Screen
    name="(auth)"
    options={{
      headerShown: false
    }}/>

    <Stack.Screen
    name="(tabs)"
    options={{
      headerShown: false
    }}/>

    <Stack.Screen
    name="Reports/[id]"
    options={{
      headerShown: false
    }}/>
  </Stack>
}