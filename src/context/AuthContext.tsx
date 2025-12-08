import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';

type SessionType = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];
type UserType = NonNullable<SessionType>['user'] | null;

interface AuthContextValue {
  session: SessionType | null;
  user: UserType;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SessionType | null>(null);
  const [user, setUser] = useState<UserType>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setFromSession = useCallback((next: SessionType | null) => {
    setSession(next);
    setUser(next?.user ?? null);
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) return;
        
        // Handle refresh token errors gracefully
        if (error) {
          const isRefreshTokenError = error.message?.includes('Refresh Token') || 
                                      error.message?.includes('refresh_token') ||
                                      error.status === 400;
          
          if (isRefreshTokenError) {
            // Invalid refresh token - clear session silently
            if (__DEV__) {
              console.warn('Invalid refresh token detected, clearing session:', error.message);
            }
            try {
              // Clear local storage to remove invalid tokens
              await supabase.auth.signOut();
            } catch {
              // Ignore sign out errors
            }
            setFromSession(null);
          } else {
            // Other errors - still clear session to be safe
            if (__DEV__) {
              console.warn('Auth session error:', error.message);
            }
            setFromSession(null);
          }
        } else {
          setFromSession(data.session ?? null);
        }
      } catch (error: any) {
        // Handle unexpected errors
        if (!isMounted) return;
        if (__DEV__) {
          console.warn('Unexpected auth error:', error);
        }
        setFromSession(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      // Handle token refresh errors
      if (event === 'TOKEN_REFRESHED') {
        if (currentSession) {
          setFromSession(currentSession);
        } else {
          // Token refresh failed - clear session
          if (__DEV__) {
            console.warn('Token refresh failed, clearing session');
          }
          try {
            await supabase.auth.signOut();
          } catch {
            // Ignore sign out errors
          }
          setFromSession(null);
        }
        return;
      }

      if (event === 'USER_UPDATED' || event === 'SIGNED_IN') {
        setFromSession(currentSession ?? null);
        return;
      }

      if (event === 'SIGNED_OUT') {
        // Offline-first rule: if offline, ignore false-negative sign-out
        try {
          const state = await NetInfo.fetch();
          const isOnline = Boolean(state.isConnected && (state.isInternetReachable ?? true));
          if (!isOnline) {
            // Keep existing session if any; do not force logout while offline
            return;
          }
        } catch {
          // If network check fails, default to online behavior to avoid sticky sessions
        }
        setFromSession(null);
        return;
      }
    });

    return () => {
      isMounted = false;
      sub.subscription?.unsubscribe();
    };
  }, [setFromSession]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // App has come to the foreground, refresh the session to ensure token is valid
        supabase.auth.getSession();
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  const value = useMemo(() => ({ session, user, isLoading }), [session, user, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};


