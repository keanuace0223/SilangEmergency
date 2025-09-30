import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  barangay: string;
  barangay_position: string;
  profile_pic?: string;
}

interface UserContextType {
  user: User | null;
  login: (userData: User) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      console.log('Loading user data...');
      const userData = await AsyncStorage.getItem('userData');
      console.log('UserData from storage:', userData);
      
      if (userData) {
        const parsedUser = JSON.parse(userData);
        console.log('Parsed user:', parsedUser);
        // Map the user data to match our User interface
        const mappedUser: User = {
          id: parsedUser.id,
          name: parsedUser.name,
          email: parsedUser.userID, // userID is used as email in this system
          barangay: parsedUser.barangay,
          barangay_position: parsedUser.barangay_position,
          profile_pic: parsedUser.profile_pic || undefined
        };
        console.log('Mapped user:', mappedUser);
        setUser(mappedUser);
      } else {
        console.log('No user data found in storage');
        setUser(null);
      }
    } catch (error) {
      console.error('Error loading user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (userData: User) => {
    try {
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('authToken');
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    await loadUser();
  }, [loadUser]);

  return (
    <UserContext.Provider value={{ user, login, logout, refreshUser, isLoading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
