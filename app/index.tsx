import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useUser } from '../src/context/UserContext';

export default function Index() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { user } = useUser();
  const [isAdminByStorage, setIsAdminByStorage] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuthStatus();
    // Also precompute admin from storage to avoid context race
    (async () => {
      try {
        const userData = await AsyncStorage.getItem('userData');
        if (!userData) { setIsAdminByStorage(false); return; }
        const parsed = JSON.parse(userData);
        const adminUserIds = ['admin1','admin2','admin3'];
        const userid = parsed?.userID || parsed?.userid || '';
        setIsAdminByStorage(!!userid && adminUserIds.includes(String(userid)));
      } catch {
        setIsAdminByStorage(false);
      }
    })();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('userData');
      const authenticated = !!(token || userData);
      setIsAuthenticated(authenticated);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
    }
  };

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-lg text-gray-600">Loading...</Text>
      </View>
    );
  }

  // Redirect based on authentication status and role
  if (isAuthenticated) {
    const adminUserIds = ['admin1','admin2','admin3'];
    const isAdminFromContext = !!(user?.userid && adminUserIds.includes(user.userid));
    const isAdmin = isAdminFromContext || isAdminByStorage === true;
    return <Redirect href={isAdmin ? '/(admin)' : '/(tabs)'} />;
  } else {
    return <Redirect href="/(auth)/sign-in" />;
  }
}
