import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { Report, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';

interface NotificationContextValue {
  schedulePushNotification: (status: Report['status']) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { notificationsEnabled } = useSettings();
  const appState = useRef(AppState.currentState);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  const schedulePushNotification = useCallback(async (status: Report['status']) => {
    if (!notificationsEnabled || Constants.appOwnership === 'expo') {
      return;
    }

    const body = (() => {
      switch (status) {
        case 'ACKNOWLEDGED':
          return 'Report Accepted. We have received and acknowledged your report.';
        case 'ON_GOING':
          return null;
        case 'RESOLVED':
          return 'Case Closed. Thank you for using Silang Emergency.';
        default:
          return null;
      }
    })();

    if (!body) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Report Update',
        body,
        sound: 'default',
      },
      trigger: null, // Immediately
    });
  }, [notificationsEnabled]);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: notificationsEnabled,
        shouldPlaySound: notificationsEnabled,
        shouldSetBadge: false,
        // Pass-through for older iOS versions, controlled by the main boolean
        shouldShowBanner: notificationsEnabled,
        shouldShowList: notificationsEnabled,
      }),
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('--- FOREGROUND NOTIFICATION RECEIVED ---', notification.request.content.data);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('--- NOTIFICATION TAPPED ---', response.notification.request.content.data);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [notificationsEnabled]);

  useEffect(() => {
    const registerForPushNotificationsAsync = async () => {
      if (!Constants.isDevice || Constants.appOwnership === 'expo') {
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Failed to get notification permissions!');
      }
    };

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
      .on(
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reports',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: { new: Report; old: Report }) => {
          if (payload.new.status !== payload.old.status) {
            schedulePushNotification(payload.new.status);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, schedulePushNotification]);

  const value = useMemo<NotificationContextValue>(
    () => ({ schedulePushNotification }),
    [schedulePushNotification],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (ctx === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return ctx;
};
