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
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Permission Denied', 'Failed to get push token for push notification!');
      return;
    }
  }

  async function schedulePushNotification(status: 'PENDING' | 'ACKNOWLEDGED' | 'ON_GOING' | 'RESOLVED' | 'DECLINED') {
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
