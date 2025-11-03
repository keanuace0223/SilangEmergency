import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSignedAvatarUrl } from '../lib/supabase';
import { sessionManager } from '../utils/sessionManager';

// Cache for signed URLs to avoid repeated network calls
const urlCache = new Map<string, { url: string; expires: number }>();
const CACHE_DURATION = 23 * 60 * 60 * 1000; // 23 hours (shorter than 24 hour expiry)

interface User {
  id: string;
  userid: string;
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
  refreshKey: number;
  triggerRefresh: () => void;
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
  const [refreshKey, setRefreshKey] = useState(0);

  const loadUser = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      
      if (userData) {
        const parsedUser = JSON.parse(userData);
        const mappedUser: User = {
          id: String(parsedUser.id),
          userid: String(parsedUser.userID || parsedUser.userid || ''),
          name: parsedUser.name,
          email: parsedUser.email || parsedUser.userID || `${parsedUser.userID}@login.local`,
          barangay: parsedUser.barangay,
          barangay_position: parsedUser.barangay_position,
          profile_pic: parsedUser.profile_pic || undefined
        };
        setUser(mappedUser);
        
        // Lazy load signed URL in background for storage paths
        if (parsedUser.profile_pic && typeof parsedUser.profile_pic === 'string' && parsedUser.profile_pic.includes('/')) {
          getCachedSignedUrl(parsedUser.profile_pic).then(signedUrl => {
            if (signedUrl) {
              setUser(prevUser => prevUser ? { ...prevUser, profile_pic: signedUrl } : prevUser);
            }
          }).catch(() => {
            // Silent fail for profile pic loading
          });
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      // Initialize and validate session manager
      await sessionManager.initialize();
      
      // Load user data
      await loadUser();
    };
    
    initializeApp();
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
      // Terminate current session
      if (sessionManager.hasActiveSession()) {
        try {
          await sessionManager.terminateSession();
        } catch (error) {
          console.warn('Failed to terminate session:', error);
        }
      }
      
      // Sign out from Supabase
      try {
        const { supabase } = await import('../lib/supabase');
        await supabase.auth.signOut();
      } catch (error) {
        console.warn('Failed to sign out from Supabase:', error);
      }
      
      // Clear session manager
      await sessionManager.clearSession();
      
      // Clear all storage
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('sessionId');
      await AsyncStorage.removeItem('sessionToken');
      
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    await loadUser();
  }, [loadUser]);

  const triggerRefresh = useCallback(() => {
    setRefreshKey(prevKey => prevKey + 1);
  }, []);

  return (
    <UserContext.Provider value={{ user, login, logout, refreshUser, isLoading, refreshKey, triggerRefresh }}>
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
