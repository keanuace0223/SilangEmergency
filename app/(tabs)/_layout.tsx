import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, Tabs, useFocusEffect } from 'expo-router';
import React from 'react';
import '../global.css';


const TAB_BAR_SHADOW = {
  backgroundColor: '#fff',
  borderTopWidth: 0,
  // iOS shadow
  shadowColor: '#000',
  shadowOffset: { width: 0, height: -3 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
  // Android shadow
  elevation: 10,

};

const TabsLayout = () => {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  
  React.useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        setIsAuthenticated(!!token);
      } catch (error) {
        console.error('Error checking auth:', error);
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    
    checkAuth();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      const recheck = async () => {
        try {
          const token = await AsyncStorage.getItem('authToken');
          if (isActive) setIsAuthenticated(!!token);
        } catch (error) {
          console.error('Error re-checking auth on focus:', error);
          if (isActive) setIsAuthenticated(false);
        }
      };
      recheck();
      return () => { isActive = false };
    }, [])
  );

  if (isCheckingAuth) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (

  
    
    <Tabs 
    screenOptions={{
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: '#8E8E93',

        tabBarItemStyle:{
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 15,
        },
        
        tabBarStyle: {...TAB_BAR_SHADOW,

            borderRadius: 50,
            marginHorizontal: 10,
            marginBottom: 60,
            height: 70,
            position: 'absolute',
            overflow: 'hidden',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
         },

        tabBarLabelStyle: { fontSize: 12, fontWeight: 'bold' },
        

    
    }}>
        <Tabs.Screen
            name="index"
            options={{
                title: 'Home',
                headerShown: false,
    tabBarIcon: ({ color, size }: { color: string; size: number }) => (
      <Ionicons name="home" size={size ?? 25} color={color} />
    ),
                
            }}
        />

        <Tabs.Screen
            name="reports"
            options={{
                title: 'Reports',
                headerShown: false,
                 tabBarIcon: ({ color, size }: { color: string; size: number }) => (
      <Ionicons name="newspaper" size={size ?? 25} color={color} />
    ),
            }}
        />

        
     <Tabs.Screen
            name="drafts"
            options={{
                title: 'Drafts',
                headerShown: false,
                 tabBarIcon: ({ color, size }: { color: string; size: number }) => (
      <Ionicons name="documents" size={size ?? 25} color={color} />
        ),
            }}
        />   

         <Tabs.Screen
            name="profile"
            options={{
                title: 'Profile',
                headerShown: false,
                 tabBarIcon: ({ color, size }: { color: string; size: number }) => (
      <Ionicons name="person" size={size ?? 25} color={color} />
    ),
            }}
        />

    </Tabs>

    
  )

}

export default TabsLayout;