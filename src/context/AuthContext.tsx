import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        setFromSession(data.session ?? null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'SIGNED_IN') {
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


