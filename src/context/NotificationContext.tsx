import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { Report, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const NotificationContext = createContext({});

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Set how notifications are handled when the app is in the foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true, // For older iOS versions
        shouldShowList: true,   // For older iOS versions
      }),
    });

    // This listener is fired whenever a notification is received while the app is running
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('--- FOREGROUND NOTIFICATION RECEIVED ---');
      console.log(JSON.stringify(notification.request.content.data, null, 2));
    });

    // This listener is fired whenever a user taps on or interacts with a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('--- NOTIFICATION TAPPED ---');
      console.log(JSON.stringify(response.notification.request.content.data, null, 2));
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  useEffect(() => {
    registerForPushNotificationsAsync();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('realtime:reports')
      .on('postgres_changes' as any, {
        event: 'UPDATE',
        schema: 'public',
        table: 'reports',
        filter: `user_id=eq.${user.id}`
            }, (payload: { new: Report; old: Report }) => {
        if (payload.new.status !== payload.old.status) {
          schedulePushNotification(payload.new.status);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function registerForPushNotificationsAsync() {
    if (!Constants.isDevice) {
      return;
    }

    // Skip notification permission flow entirely in Expo Go to avoid remote push errors
    if (Constants.appOwnership === 'expo') {
      return;
    }

    const Notifications = await import('expo-notifications');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Permission Denied', 'Failed to get notification permissions!');
      return;
    }
  }

  async function schedulePushNotification(status: 'PENDING' | 'ACKNOWLEDGED' | 'ON_GOING' | 'RESOLVED' | 'DECLINED') {
    // Local notifications are also not needed in Expo Go for server-side status changes
    if (Constants.appOwnership === 'expo') {
      return;
    }

    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Report Update",
        body: `Your report is now marked as ${status}`,
        sound: 'default',
      },
      trigger: null,
    });
  }

  return (
    <NotificationContext.Provider value={{}}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);
