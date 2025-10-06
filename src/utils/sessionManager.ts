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

  // Check for active sessions for a user using Supabase user_sessions
  async checkActiveSessions(userId: string): Promise<SessionCheckResult> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('id, last_activity, created_at, ip_address, device_info')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_activity', { ascending: false });
      if (error) throw error;
      const sessions: ActiveSession[] = (data || []).map((row: any) => ({
        id: row.id,
        device_info: row.device_info || {},
        ip_address: row.ip_address || undefined,
        last_activity: row.last_activity,
        created_at: row.created_at,
      }));
      return { sessionCount: sessions.length, activeSessions: sessions };
    } catch {
      // Fail open: if we cannot verify (e.g., RLS not yet configured), let insert guard handle it
      return { sessionCount: 0, activeSessions: [] };
    }
  }

  // Create a new session; optionally force single session by deactivating others
  async createSession(userId: string, forceSingleSession: boolean = false): Promise<SessionCreateResult> {
    // Deactivate other active sessions when forcing
    if (forceSingleSession) {
      await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);
    } else {
      // Guard: if other sessions exist, surface to caller
      const check = await this.checkActiveSessions(userId);
      if (check.sessionCount > 0) {
        return {
          success: false,
          sessionToken: '',
          sessionId: '',
          existingSessions: check.sessionCount,
          deviceInfo: {},
          ipAddress: ''
        };
      }
    }

    const deviceInfo = await this.getDeviceInfo();
    // Try to capture the current Supabase access token for traceability
    let sessionTokenValue = '';
    try {
      const { data: s } = await supabase.auth.getSession();
      sessionTokenValue = s?.session?.access_token || '';
    } catch {}
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        is_active: true,
        last_activity: now,
        device_info: deviceInfo,
        session_token: sessionTokenValue || null,
      })
      .select('id, ip_address')
      .single();
    if (error) {
      // Surface details to help diagnose RLS/constraint issues
      console.warn('createSession insert error:', error);
      const code = (error as any)?.code || (error as any)?.details || '';
      const isUnique = String(code).includes('23505') || String((error as any)?.message || '').toLowerCase().includes('unique');
      return {
        success: false,
        sessionToken: '',
        sessionId: '',
        existingSessions: isUnique ? 1 : 0,
        deviceInfo,
        ipAddress: ''
      };
    }
    this.currentSessionId = data?.id || null;
    await AsyncStorage.setItem('sessionId', String(this.currentSessionId));
    // Optional: store token analogue for parity
    this.sessionToken = String(this.currentSessionId);
    return {
      success: true,
      sessionToken: this.sessionToken,
      sessionId: this.currentSessionId || '',
      existingSessions: 0,
      deviceInfo,
      ipAddress: data?.ip_address || ''
    };
  }

  // Terminate current session
  async terminateSession(sessionToken?: string): Promise<boolean> {
    try {
      const id = sessionToken || this.currentSessionId || (await AsyncStorage.getItem('sessionId')) || '';
      if (!id) return true;
      await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', id);
      this.currentSessionId = null;
      this.sessionToken = null;
      await AsyncStorage.removeItem('sessionId');
      this.stopHeartbeat();
      return true;
    } catch {
      return false;
    }
  }

  // Update session activity (heartbeat)
  async updateActivity(): Promise<boolean> {
    try {
      const id = this.currentSessionId || (await AsyncStorage.getItem('sessionId')) || '';
      if (!id) return false;
      await supabase
        .from('user_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', id)
        .eq('is_active', true);
      return true;
    } catch {
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

  // Initialize from storage
  async initialize(): Promise<void> {
    this.currentSessionId = (await AsyncStorage.getItem('sessionId')) || null;
  }

  // Check if user has active session
  hasActiveSession(): boolean {
    return Boolean(this.currentSessionId);
  }

  // Clear all session data
  async clearSession(): Promise<void> {
    this.sessionToken = null;
    this.stopHeartbeat();
    await AsyncStorage.removeItem('sessionToken');
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