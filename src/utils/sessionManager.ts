import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export interface ActiveSession {
  id: string;
  device_info?: {
    deviceName?: string;
    platform?: string;
    deviceType?: string;
    userAgent?: string;
  };
  ip_address?: string;
  last_activity: string;
  created_at: string;
}

export interface SessionCheckResult {
  sessionCount: number;
  activeSessions: ActiveSession[];
}

export interface SessionCreateResult {
  success: boolean;
  sessionToken: string;
  sessionId: string;
  existingSessions: number;
  deviceInfo: any;
  ipAddress: string;
}

class SessionManager {
  private sessionToken: string | null = null;
  private heartbeatInterval: any | null = null;
  private currentSessionId: string | null = null;
  private recentConstraintViolations: Set<string> = new Set(); // Track recent constraint violations per user

  // Check for active sessions for a user using Supabase user_sessions via RPC
  async checkActiveSessions(userId: string): Promise<SessionCheckResult> {
    try {
      console.log('[checkActiveSessions] Checking for userId:', userId);
      const { data, error } = await supabase.rpc('check_active_sessions', {
        p_user_id: userId
      });
      
      console.log('[checkActiveSessions] RPC result:', { hasData: !!data, hasError: !!error, data, error });
      
      if (error) {
        console.warn('[checkActiveSessions] RPC error:', error);
        throw error;
      }
      
      // The RPC returns an array with { session_count: number, active_sessions: JSONB }
      const rpcResult = Array.isArray(data) ? data[0] : data;
      const sessionCount = rpcResult?.session_count || 0;
      const activeSessionsJson = rpcResult?.active_sessions || [];
      
      console.log('[checkActiveSessions] Parsed result:', { sessionCount, activeSessionsJson });
      
      // Parse the JSONB array into ActiveSession[]
      const sessions: ActiveSession[] = Array.isArray(activeSessionsJson)
        ? activeSessionsJson.map((row: any) => ({
            id: row.id,
            device_info: row.device_info || {},
            ip_address: row.ip_address || undefined,
            last_activity: row.last_activity,
            created_at: row.created_at,
          }))
        : [];
      
      console.log('[checkActiveSessions] Final sessions:', sessions.length);
      return { sessionCount, activeSessions: sessions };
    } catch (error) {
      console.warn('[checkActiveSessions] Failed to check active sessions via RPC:', error);
      // Fail open: if we cannot verify (e.g., RLS not yet configured), let insert guard handle it
      return { sessionCount: 0, activeSessions: [] };
    }
  }

  // Create a new session; optionally force single session by deactivating others
  async createSession(userId: string, forceSingleSession: boolean = false): Promise<SessionCreateResult> {
    console.log('[createSession] Called with userId:', userId, 'hasRecentViolation:', this.recentConstraintViolations.has(userId));
    try {
      const deviceInfo = await this.getDeviceInfo();
      
      // Get the current Supabase access token (this is the session_token used in the database)
      let sessionTokenValue = '';
      try {
        const { data: s } = await supabase.auth.getSession();
        sessionTokenValue = s?.session?.access_token || '';
        if (!sessionTokenValue) {
          throw new Error('No active Supabase session token available');
        }
      } catch (error) {
        console.warn('Failed to get Supabase session token:', error);
        return {
          success: false,
          sessionToken: '',
          sessionId: '',
          existingSessions: 0,
          deviceInfo,
          ipAddress: ''
        };
      }

      // If not forcing single session, check for existing sessions first
      // The SQL function always creates a session, so we need to prevent that if not forcing
      // This is a redundant check - the caller should already check, but this is a safety net
      if (!forceSingleSession) {
        // Always check the database first, even if we have recent violation tracking
        // This ensures we're checking the actual current state, not cached state
        const checkResult = await this.checkActiveSessions(userId);
        console.log('[createSession] Early checkActiveSessions returned:', checkResult.sessionCount);
        
        // If we have recent violation tracking but database shows no sessions, clear the tracking
        if (this.recentConstraintViolations.has(userId) && checkResult.sessionCount === 0) {
          console.log('[createSession] Clearing recent violation tracking - no sessions found in database');
          this.recentConstraintViolations.delete(userId);
        }
        
        if (checkResult.sessionCount > 0) {
          // CRITICAL: Do not create session if active sessions exist
          return {
            success: false,
            sessionToken: sessionTokenValue,
            sessionId: '',
            existingSessions: checkResult.sessionCount,
            deviceInfo,
            ipAddress: ''
          };
        }
        
        // If we had recent violation but database check shows no sessions, proceed normally
        // (the violation was probably from a session that was deleted)
      }

      // Call the PostgreSQL function via RPC
      // Note: The SQL function will handle deactivating existing sessions if force_single_session is true
      console.log('[createSession] Calling RPC create_user_session with:', {
        userId,
        hasToken: !!sessionTokenValue,
        forceSingleSession
      });
      const { data, error } = await supabase.rpc('create_user_session', {
        p_user_id: userId,
        p_session_token: sessionTokenValue,
        p_device_info: deviceInfo,
        p_ip_address: null, // IP address is typically captured server-side
        p_user_agent: 'React Native',
        p_force_single_session: forceSingleSession
      });

      console.log('[createSession] RPC call result:', { hasData: !!data, hasError: !!error, data, error });

      if (error) {
        console.warn('createSession RPC error:', error);
        console.log('createSession error details:', {
          code: error.code,
          message: error.message,
          codeType: typeof error.code,
          messageType: typeof error.message
        });
        
        // Handle unique constraint violation (error code 23505)
        // This means the user already has an active session
        // Check both string and numeric error codes
        // Convert error code to string for comparison (handles both string and numeric codes)
        const errorCode = String(error.code || '');
        const errorMessage = String(error.message || '').toLowerCase();
        const isConstraintViolation = 
          errorCode === '23505' || 
          errorMessage.includes('already has an active session') ||
          errorMessage.includes('unique constraint') ||
          errorMessage.includes('duplicate key');
        
        console.log('createSession constraint check:', {
          errorCode,
          errorMessage,
          isConstraintViolation
        });
        
        if (isConstraintViolation) {
          console.log('[createSession] Detected constraint violation - user already has active session');
          // Track this constraint violation for this user (for a short time window)
          this.recentConstraintViolations.add(userId);
          // Clear after 5 minutes
          setTimeout(() => this.recentConstraintViolations.delete(userId), 5 * 60 * 1000);
          
          // CRITICAL: A constraint violation means there IS at least one active session
          // We ALWAYS return at least 1, regardless of what checkActiveSessions says
          // (checkActiveSessions may return 0 due to RLS, timing, or other issues)
          let sessionCount = 1; // Default to 1 since constraint violation proves a session exists
          
          // Try to fetch the actual session count, but don't trust it if it's 0
          try {
            const checkResult = await this.checkActiveSessions(userId);
            console.log('[createSession] checkActiveSessions returned:', checkResult.sessionCount);
            // If checkActiveSessions returns a valid count > 0, use it
            // Otherwise, stick with 1 (constraint violation proves at least 1 exists)
            if (checkResult.sessionCount > 0) {
              sessionCount = checkResult.sessionCount;
            } else {
              console.warn('[createSession] checkActiveSessions returned 0, but constraint violation exists - using 1');
            }
          } catch (checkError) {
            console.warn('[createSession] Failed to check active sessions, assuming 1 session exists:', checkError);
          }
          
          // Always return at least 1 when constraint violation is detected
          return {
            success: false,
            sessionToken: sessionTokenValue,
            sessionId: '',
            existingSessions: sessionCount,
            deviceInfo,
            ipAddress: ''
          };
        }
        
        // If we recently had a constraint violation for this user, verify database state first
        // This handles cases where the error format might be slightly different on subsequent calls
        if (this.recentConstraintViolations.has(userId) && error) {
          console.warn('[createSession] Recent constraint violation for this user, verifying database state');
          // Check database to see if session actually exists
          try {
            const checkResult = await this.checkActiveSessions(userId);
            if (checkResult.sessionCount > 0) {
              console.log('[createSession] Verified existing sessions in database:', checkResult.sessionCount);
              return {
                success: false,
                sessionToken: sessionTokenValue,
                sessionId: '',
                existingSessions: checkResult.sessionCount,
                deviceInfo,
                ipAddress: ''
              };
            } else {
              // No sessions in database, clear the violation tracking
              console.log('[createSession] No sessions found in database, clearing violation tracking');
              this.recentConstraintViolations.delete(userId);
              // Continue to normal error handling
            }
          } catch (checkError) {
            console.warn('[createSession] Failed to verify database state, assuming session exists:', checkError);
            // If check fails, assume session exists (safer to block)
            return {
              success: false,
              sessionToken: sessionTokenValue,
              sessionId: '',
              existingSessions: 1,
              deviceInfo,
              ipAddress: ''
            };
          }
        }
        
        // For other errors, return with 0 existing sessions
        console.warn('[createSession] Failed with non-constraint error. Code:', errorCode, 'Message:', errorMessage);
        return {
          success: false,
          sessionToken: sessionTokenValue,
          sessionId: '',
          existingSessions: 0,
          deviceInfo,
          ipAddress: ''
        };
      }

      // The RPC returns an array with { success: boolean, existing_sessions: integer, session_id: uuid }
      console.log('[createSession] RPC response data:', data);
      
      // Handle array response from RPC
      const rpcResult = Array.isArray(data) ? data[0] : data;
      const success = rpcResult?.success ?? false;
      const sessionId = rpcResult?.session_id || null;
      const existingSessionsFromRPC = rpcResult?.existing_sessions ?? 0;

      console.log('[createSession] Parsed RPC result:', {
        success,
        sessionId,
        existingSessionsFromRPC,
        fullResult: rpcResult
      });

      if (!success || !sessionId) {
        console.warn('[createSession] RPC call succeeded but returned failure:', {
          success,
          sessionId,
          existingSessionsFromRPC,
          fullData: rpcResult
        });
        // If RPC returned success: false but no constraint error, it might mean existing sessions
        if (existingSessionsFromRPC > 0) {
          console.log('[createSession] RPC indicated existing sessions:', existingSessionsFromRPC);
          return {
            success: false,
            sessionToken: sessionTokenValue,
            sessionId: sessionId || '',
            existingSessions: existingSessionsFromRPC,
            deviceInfo,
            ipAddress: ''
          };
        }
        return {
          success: false,
          sessionToken: sessionTokenValue,
          sessionId: sessionId || '',
          existingSessions: 0,
          deviceInfo,
          ipAddress: ''
        };
      }

      // Store both session_token and session_id for reference
      this.sessionToken = sessionTokenValue;
      this.currentSessionId = sessionId;
      await AsyncStorage.setItem('sessionToken', sessionTokenValue);
      await AsyncStorage.setItem('sessionId', sessionId);

      return {
        success: true,
        sessionToken: sessionTokenValue,
        sessionId: sessionId,
        existingSessions: 0,
        deviceInfo,
        ipAddress: '' // IP address not returned by RPC, but could be queried if needed
      };
    } catch (error) {
      console.warn('createSession error:', error);
      const deviceInfo = await this.getDeviceInfo();
      return {
        success: false,
        sessionToken: '',
        sessionId: '',
        existingSessions: 0,
        deviceInfo,
        ipAddress: ''
      };
    }
  }

  // Terminate current session
  async terminateSession(sessionToken?: string): Promise<boolean> {
    try {
      // Use the provided session_token or get it from storage
      const token = sessionToken || this.sessionToken || (await AsyncStorage.getItem('sessionToken')) || '';
      if (!token) {
        // If no token but we have sessionId, we can't terminate via RPC
        // Clear local state anyway
        this.currentSessionId = null;
        this.sessionToken = null;
        await AsyncStorage.removeItem('sessionId');
        await AsyncStorage.removeItem('sessionToken');
        this.stopHeartbeat();
        return true;
      }

      // Call the PostgreSQL function via RPC
      const { data, error } = await supabase.rpc('terminate_user_session', {
        p_session_token: token
      });

      if (error) {
        console.warn('terminateSession RPC error:', error);
      }

      // Clear local state regardless of RPC result
      this.currentSessionId = null;
      this.sessionToken = null;
      await AsyncStorage.removeItem('sessionId');
      await AsyncStorage.removeItem('sessionToken');
      this.stopHeartbeat();
      
      // Return true if RPC succeeded, or if no token was found (already cleared)
      return data ?? true;
    } catch (error) {
      console.warn('terminateSession error:', error);
      // Still clear local state on error
      this.currentSessionId = null;
      this.sessionToken = null;
      await AsyncStorage.removeItem('sessionId');
      await AsyncStorage.removeItem('sessionToken');
      this.stopHeartbeat();
      return false;
    }
  }

  // Update session activity (heartbeat)
  async updateActivity(): Promise<boolean> {
    try {
      // Get the session_token from storage or current state
      const token = this.sessionToken || (await AsyncStorage.getItem('sessionToken')) || '';
      if (!token) return false;

      // Call the PostgreSQL function via RPC
      const { data, error } = await supabase.rpc('update_session_activity', {
        p_session_token: token
      });

      if (error) {
        console.warn('updateActivity RPC error:', error);
        // On network or transient errors, assume the session is still active.
        // Only a definitive 'false' from the server should invalidate it.
        return true;
      }

      // RPC returns boolean indicating if session was found and updated
      return data ?? false;
    } catch (error) {
      console.warn('updateActivity error:', error);
      return false;
    }
  }

  // Start heartbeat to keep session alive
  startHeartbeat(intervalMs: number = 60000) {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.updateActivity();
    }, Math.max(15000, intervalMs));
  }

  // Stop heartbeat
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Initialize from storage and validate session
  async initialize(): Promise<void> {
    this.currentSessionId = (await AsyncStorage.getItem('sessionId')) || null;
    this.sessionToken = (await AsyncStorage.getItem('sessionToken')) || null;
    
    // If we have a session token, validate it's still active
    if (this.sessionToken) {
      try {
        // Check both our custom session (via Supabase auth session token) and Supabase auth session
        const authSession = await supabase.auth.getSession();
        const { data: authData, error: authError } = authSession;
        
        // Handle refresh token errors gracefully
        if (authError) {
          const isRefreshTokenError = authError.message?.includes('Refresh Token') || 
                                      authError.message?.includes('refresh_token') ||
                                      authError.status === 400;
          
          if (isRefreshTokenError) {
            // Invalid refresh token - clear session silently
            if (__DEV__) {
              console.warn('Invalid refresh token detected in sessionManager, clearing session:', authError.message);
            }
            this.currentSessionId = null;
            this.sessionToken = null;
            await AsyncStorage.removeItem('sessionId');
            await AsyncStorage.removeItem('sessionToken');
            await AsyncStorage.removeItem('authToken');
            try {
              await supabase.auth.signOut();
            } catch {
              // Ignore sign out errors
            }
            return;
          }
        }
        
        // Verify the stored session_token matches the current Supabase session token
        const currentAuthToken = authData?.session?.access_token || null;
        
        if (!currentAuthToken || currentAuthToken !== this.sessionToken) {
          // Session token mismatch - Supabase session changed or expired
          console.log('Stored session token mismatch or Supabase session invalid, clearing...');
          this.currentSessionId = null;
          this.sessionToken = null;
          await AsyncStorage.removeItem('sessionId');
          await AsyncStorage.removeItem('sessionToken');
          if (!authData?.session) {
            await AsyncStorage.removeItem('authToken');
          }
          return;
        }

        // Validate the session is still active by attempting to update activity
        // This implicitly checks if the session exists and is active
        // In initialize, we only clear the session if we are CERTAIN it's invalid.
        // A failed updateActivity call (e.g. network error) should not clear the session.
        // We trust the local token until it's proven invalid by the server.
        const isActive = await this.updateActivity();
        if (isActive === false) { // Explicitly check for false
          console.log('Server confirmed session is not active, clearing...');
          this.currentSessionId = null;
          this.sessionToken = null;
          await AsyncStorage.removeItem('sessionId');
          await AsyncStorage.removeItem('sessionToken');
        }
      } catch (error) {
        console.warn('Failed to validate session:', error);
        // On error, clear the session to be safe
        this.currentSessionId = null;
        this.sessionToken = null;
        await AsyncStorage.removeItem('sessionId');
        await AsyncStorage.removeItem('sessionToken');
        await AsyncStorage.removeItem('authToken');
      }
    } else if (this.currentSessionId) {
      // Legacy: if we only have sessionId but no token, clear it
      // This handles migration from old format
      this.currentSessionId = null;
      await AsyncStorage.removeItem('sessionId');
    }
  }

  // Check if user has active session
  hasActiveSession(): boolean {
    return Boolean(this.currentSessionId);
  }

  // Clear all session data
  async clearSession(): Promise<void> {
    this.sessionToken = null;
    this.currentSessionId = null;
    this.stopHeartbeat();
    await AsyncStorage.removeItem('sessionToken');
    await AsyncStorage.removeItem('sessionId');
  }
  
  // Get session token (for external use)
  getSessionToken(): string | null {
    return this.sessionToken;
  }
  
  // Get session ID (for external use)
  getSessionId(): string | null {
    return this.currentSessionId;
  }

  // Clean up orphaned sessions for a user (useful when app is deleted/reinstalled)
  async cleanupOrphanedSessions(userId: string): Promise<void> {
    try {
      // Call the PostgreSQL function via RPC
      // Note: The function doesn't take userId parameter, it cleans up all orphaned sessions
      // This is by design - it's a cleanup function that runs server-side
      const { error } = await supabase.rpc('cleanup_orphaned_sessions');
      
      if (error) {
        console.warn('cleanupOrphanedSessions RPC error:', error);
      }
    } catch (error) {
      console.warn('Failed to cleanup orphaned sessions:', error);
    }
  }

  // Get user sessions
  async getUserSessions(userId: string): Promise<ActiveSession[]> {
    const { data } = await supabase
      .from('user_sessions')
      .select('id, last_activity, created_at, ip_address, device_info')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_activity', { ascending: false });
    return (data || []).map((row: any) => ({
      id: row.id,
      device_info: row.device_info || {},
      ip_address: row.ip_address || undefined,
      last_activity: row.last_activity,
      created_at: row.created_at,
    }));
  }

  // Get device info for session tracking
  private async getDeviceInfo() {
    return {
      deviceName: Platform.OS,
      platform: Platform.OS,
      deviceType: Platform.OS === 'ios' ? 'iOS' : 'Android',
      userAgent: 'React Native'
    };
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
