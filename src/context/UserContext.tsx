import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSignedAvatarUrl } from '../lib/supabase';

// Cache for signed URLs to avoid repeated network calls
const urlCache = new Map<string, { url: string; expires: number }>();
const CACHE_DURATION = 23 * 60 * 60 * 1000; // 23 hours (shorter than 24 hour expiry)

interface User {
  id: string;
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

// Helper function to get cached or fresh signed URL
const getCachedSignedUrl = async (filePath: string): Promise<string | null> => {
  const now = Date.now();
  const cached = urlCache.get(filePath);
  
  // Return cached URL if still valid
  if (cached && cached.expires > now) {
    return cached.url;
  }
  
  // Get fresh signed URL
  try {
    const { url } = await getSignedAvatarUrl(filePath);
    if (url) {
      // Cache the URL with expiration
      urlCache.set(filePath, {
        url,
        expires: now + CACHE_DURATION
      });
      return url;
    }
  } catch (error) {
    console.warn('Failed to get signed URL:', error);
  }
  
  return null;
};

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
          id: String(parsedUser.id),
          name: parsedUser.name,
          email: parsedUser.userID, // userID is used as email in this system
          barangay: parsedUser.barangay,
          barangay_position: parsedUser.barangay_position,
          profile_pic: parsedUser.profile_pic || undefined
        };
        // Set user immediately with storage path, then lazy load signed URL
        setUser(mappedUser);
        
        // If profile_pic looks like a storage path, lazy load the signed URL in background
        if (parsedUser.profile_pic && typeof parsedUser.profile_pic === 'string' && parsedUser.profile_pic.includes('/')) {
          // Don't await - load in background to avoid blocking UI
          getCachedSignedUrl(parsedUser.profile_pic).then(signedUrl => {
            if (signedUrl) {
              setUser(prevUser => prevUser ? { ...prevUser, profile_pic: signedUrl } : prevUser);
            }
          }).catch(error => {
            console.warn('Background profile pic loading failed:', error);
          });
        }
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
