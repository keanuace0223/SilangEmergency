import { createClient } from '@supabase/supabase-js';
// Lazy import inside functions to avoid expo web issues

// SQL migration snippet (run in Supabase):
// ALTER TABLE reports ADD COLUMN IF NOT EXISTS contact_number text;
// ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_number text;

// Environment variables with fallback
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://bhcecrbyknorjzkjazxu.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoY2VjcmJ5a25vcmp6a2phenh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDYwNDMsImV4cCI6MjA3NDc4MjA0M30.Nfv0vHVk1IyN1gz1Y4mdogL9ChsV0DkiMQivuYnolt4';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

// Create storage adapter that safely handles build-time execution
const createStorageAdapter = () => {
  // Check if we're in Node.js environment (Metro bundler/server-side)
  const isNodeEnv = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
  
  // Return AsyncStorage adapter for React Native runtime
  return {
    getItem: async (key: string) => {
      // Skip in Node.js environment (during bundling)
      if (isNodeEnv) {
        return null;
      }
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        return await AsyncStorage.getItem(key);
      } catch {
        // Silently fail during initialization
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      // Skip in Node.js environment (during bundling)
      if (isNodeEnv) {
        return;
      }
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.setItem(key, value);
      } catch {
        // Silently fail during initialization
      }
    },
    removeItem: async (key: string) => {
      // Skip in Node.js environment (during bundling)
      if (isNodeEnv) {
        return;
      }
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.removeItem(key);
      } catch {
        // Silently fail during initialization
      }
    },
  };
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createStorageAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const AVATAR_BUCKET = process.env.EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET || 'avatars';
const REPORTS_BUCKET = process.env.EXPO_PUBLIC_SUPABASE_REPORTS_BUCKET || 'reports';

// Database types
export interface User {
  id: string;
  userid: string;
  name: string;
  barangay: string;
  barangay_position: string;
  contact_number?: string;
  profile_pic?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Report {
  id: string;
  user_id: string;
  incident_type: string;
  location: string;
  contact_number: string;
  patient_status: 'Alert' | 'Voice' | 'Pain' | 'Unresponsive' | 'No Patient';
  report_type?: 'official' | 'follow-up';
  description: string;
  uploaded_media: string[];
  incident_datetime: string;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'ON_GOING' | 'RESOLVED' | 'DECLINED';
  created_at?: string;
  updated_at?: string;
}

// Auth functions
export const auth = {
  signUp: async (email: string, password: string, userData: {
    name: string;
    barangay: string;
    barangay_position: string;
  }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    });
    return { data, error };
  },

  // Custom userid login via RPC
  signInWithUserid: async (userid: string, password: string) => {
    const { data, error } = await supabase.rpc('login_with_userid', {
      p_userid: userid,
      p_password: password
    });
    return { data, error };
  },

  // Preferred: create a real Supabase session using an email alias for userid
  signInWithUseridAlias: async (userid: string, password: string) => {
    const email = `${userid}@login.local`;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  // Change password for the currently authenticated user
  changePassword: async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    return { data, error };
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  getSession: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
  }
};

// Database functions
export const db = {
  // Users
  getUsers: async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name', { ascending: true });
    return { data, error };
  },

  getUser: async (id: string) => {
    // Get authenticated user ID from auth context to ensure RLS compatibility
    let authUserId: string | null = id;
    try {
      const { data: authData } = await supabase.auth.getSession();
      if (authData?.session?.user?.id) {
        authUserId = authData.session.user.id;
      } else {
        // Try to get current user directly
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          authUserId = userData.user.id;
        }
      }
    } catch (err) {
      if (__DEV__) console.warn('Failed to get auth session in getUser:', err);
    }
    
    // Validate authUserId before using it
    if (!authUserId || authUserId === 'null') {
      if (__DEV__) console.warn('No authenticated user ID, using provided ID:', id);
      authUserId = id;
    }
    
    // Ensure authUserId is valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(authUserId)) {
      if (__DEV__) console.warn('authUserId is not valid UUID format:', authUserId);
      return { data: null, error: { message: 'Invalid user ID format' } as any };
    }
    
    // Try with authenticated user ID first - use explicit UUID cast
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .single();
      
      if (__DEV__) {
        if (error) {
          // Only log errors that aren't "0 rows" (expected if profile doesn't exist yet)
          if (error.code !== 'PGRST116') {
            console.error('getUser query error:', error);
            console.error('Query was for authUserId:', authUserId);
          }
        } else if (data) {
          console.log('getUser success:', data.name || 'no name');
        } else {
          // Don't warn about no data - it's expected if profile doesn't exist
        }
      }
      
      if (!error && data) {
        return { data, error: null };
      }
      
      // If that fails and IDs are different, try with provided ID
      if (error && id !== authUserId && uuidRegex.test(id)) {
        const altQuery = await supabase
          .from('users')
          .select('*')
          .eq('id', id)
          .single();
        return { data: altQuery.data, error: altQuery.error };
      }
      
      return { data, error };
    } catch (err) {
      if (__DEV__) console.error('getUser exception:', err);
      return { data: null, error: err as any };
    }
  },

  getUserByUserid: async (userid: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('userid', userid)
      .single();
    return { data, error };
  },

  updateUser: async (id: string, updates: Partial<User>) => {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  upsertUser: async (profile: Partial<User> & { id: string; userid: string }) => {
    // Ensure required fields are present
    const userProfile = {
      id: profile.id,
      userid: profile.userid || '',
      name: profile.name || profile.userid || '',
      barangay: profile.barangay || '',
      barangay_position: profile.barangay_position || '',
      profile_pic: profile.profile_pic || null,
    };
    
    if (__DEV__) {
      console.log('Upserting user profile:', userProfile.id, userProfile.userid, userProfile.name);
    }
    
    // Try upsert first
    const { data, error } = await supabase
      .from('users')
      .upsert(userProfile, { onConflict: 'id' })
      .select()
      .single();
    
    // If RLS blocks the upsert, it's OK - the profile might already exist
    // The app will still work if profile exists, just can't create/update during sign-in
    if (error) {
      if (__DEV__) {
        if (error.code === '42501') {
          console.warn('upsertUser RLS blocked - profile may already exist or RLS needs fixing');
          console.warn('This is OK if profile exists. Run FINAL_FIX_EVERYTHING.sql to fix RLS.');
        } else {
          console.error('upsertUser error:', error);
        }
      }
    }
    
    return { data, error };
  },

  // Reports
  getReports: async (userId: string) => {
    // Get authenticated user ID from auth context
    let authUserId: string | null = userId;
    try {
      const { data: authData } = await supabase.auth.getSession();
      if (authData?.session?.user?.id) {
        authUserId = authData.session.user.id;
      } else {
        // Try to get current user directly
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          authUserId = userData.user.id;
        }
      }
    } catch {}

    // Validate authUserId - if null, use provided userId
    if (!authUserId || authUserId === 'null') {
      if (__DEV__) console.warn('No authenticated user ID for reports, using provided userId:', userId);
      authUserId = userId;
    }

    // Prefer RPC if available (works well with RLS and legacy data)
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('app_get_my_reports');
      if (rpcErr) {
        if (__DEV__) {
          console.warn('RPC app_get_my_reports error:', rpcErr);
          // If RPC doesn't exist (code 42883), that's fine, continue to direct query
          if (rpcErr.code === '42883' || rpcErr.message?.includes('does not exist')) {
            console.log('RPC function does not exist, using direct query');
          }
        }
      } else if (Array.isArray(rpcData) && rpcData.length > 0) {
        if (__DEV__) console.log('Reports fetched via RPC:', rpcData.length);
        return { data: rpcData as any[], error: null as any };
      } else if (Array.isArray(rpcData)) {
        // RPC returned empty array, try direct query anyway
        if (__DEV__) console.log('RPC returned empty array, trying direct query');
      }
    } catch (err) {
      if (__DEV__) console.warn('RPC app_get_my_reports exception:', err);
    }

    // Try with authenticated user ID (direct query)
    if (__DEV__) console.log('Fetching reports with authUserId:', authUserId);

    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', authUserId)
        .order('incident_datetime', { ascending: false });

      if (error) {
        if (__DEV__) {
          console.error('Reports query error:', error);
          console.error('Error code:', error.code);
          // If RLS error, log it specifically
          if (error.code === '42501') {
            console.error('RLS blocking reports query - check policies');
          }
        }
        // If RLS error, try to return empty array gracefully
        if (error.code === '42501') {
          return { data: [], error: null as any };
        }
        return { data: [], error };
      }

      if (data) {
        if (__DEV__) {
          console.log('Reports fetched via direct query:', data.length);
          if (data.length > 0) {
            console.log('First report:', data[0].incident_type);
          }
        }
        return { data, error: null };
      }

      // No data and no error - might be empty or RLS issue
      if (__DEV__) {
        console.warn('No reports returned - might be RLS or no data exists');
      }
      return { data: [], error: null };
    } catch (err) {
      if (__DEV__) {
        console.error('Reports query exception:', err);
      }
      return { data: [], error: err as any };
    }
  },

getReport: async (id: string) => {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .single();
  return { data, error };
},

createReport: async (reportData: Omit<Report, 'id' | 'created_at' | 'updated_at'>) => {
  // Always allow creating reports; no per-hour report limit.
  const reportType: 'official' | 'follow-up' = 'official';

  const reportDataWithType = {
    ...reportData,
    report_type: reportType,
  };

  const { data, error } = await supabase
    .from('reports')
    .insert(reportDataWithType)
    .select()
    .single();
  return { data, error };
},

  updateReport: async (id: string, updates: Partial<Report>) => {
    const { data, error } = await supabase
      .from('reports')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },
};

// Storage helpers
export async function uploadProfileImage(userId: string, fileUri: string): Promise<{ path?: string; signedUrl?: string; error?: Error }> {
  try {
    const response = await fetch(fileUri);
    const arrayBuffer = await response.arrayBuffer();
    // Derive extension from URI if possible; fallback jpeg
    const uriLower = fileUri.toLowerCase();
    const extMatch = uriLower.match(/\.([a-z0-9]+)(?:\?|#|$)/);
    const fileExt = (extMatch && extMatch[1]) || 'jpg';
    const contentType = fileExt === 'png' ? 'image/png' : fileExt === 'webp' ? 'image/webp' : 'image/jpeg';
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, arrayBuffer, {
        cacheControl: '86400', // 24 hours cache instead of 1 hour
        upsert: true,
        contentType,
      });
    if (uploadError) {
      console.warn('Supabase storage upload error', uploadError);
      return { error: uploadError as any };
    }

    // Return storage path and a longer-lived signed URL for immediate preview
    const { data: signed, error: signedErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(filePath, 24 * 60 * 60); // 24 hours
    if (signedErr) {
      console.warn('Supabase createSignedUrl error', signedErr);
      return { path: filePath };
    }
    return { path: filePath, signedUrl: signed?.signedUrl };
  } catch (e: any) {
    return { error: e };
  }
}

export async function getSignedAvatarUrl(filePath: string, expiresInSeconds = 24 * 60 * 60): Promise<{ url?: string; error?: Error }>{
  try {
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(filePath, expiresInSeconds);
    if (error) return { error: error as any };
    return { url: data?.signedUrl };
  } catch (e: any) {
    return { error: e };
  }
}

export async function deleteAvatar(filePath: string): Promise<{ error?: Error }>{
  try {
    const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([filePath]);
    if (error) return { error: error as any };
    return {};
  } catch (e: any) {
    return { error: e };
  }
}

// Report media storage helpers
async function uriToArrayBuffer(fileUri: string): Promise<ArrayBuffer> {
  // Try simple fetch first (works for file:// on iOS and many Android cases)
  try {
    const res = await fetch(fileUri);
    return await res.arrayBuffer();
  } catch {}
  // Fallback to Expo FileSystem for content:// and other URIs
  try {
    const FileSystem = await import('expo-file-system');
    const base64 = await (FileSystem as any).readAsStringAsync(fileUri, { encoding: 'base64' });
    const blob = await fetch(`data:application/octet-stream;base64,${base64}`).then(r => r.blob());
    return await blob.arrayBuffer();
  } catch (e) {
    throw e;
  }
}

export async function uploadReportMedia(userId: string, fileUri: string): Promise<{ url?: string; path?: string; error?: Error }>{
  try {
    const arrayBuffer = await uriToArrayBuffer(fileUri);
    const uriLower = fileUri.toLowerCase();
    const extMatch = uriLower.match(/\.([a-z0-9]+)(?:\?|#|$)/);
    const fileExt = (extMatch && extMatch[1]) || 'jpg';
    const contentType = fileExt === 'png' ? 'image/png' : fileExt === 'webp' ? 'image/webp' : 'image/jpeg';
    const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(REPORTS_BUCKET)
      .upload(filePath, arrayBuffer, {
        cacheControl: '86400',
        upsert: true,
        contentType,
      });
    if (uploadError) return { error: uploadError as any };

    // Prefer public URL if bucket is public; fallback to signed URL
    const { data: pub } = supabase.storage.from(REPORTS_BUCKET).getPublicUrl(filePath);
    if (pub?.publicUrl) {
      return { url: pub.publicUrl, path: filePath };
    }
    const { data: signed, error: signedErr } = await supabase.storage
      .from(REPORTS_BUCKET)
      .createSignedUrl(filePath, 7 * 24 * 60 * 60); // 7 days
    if (signedErr) return { path: filePath };
    return { url: signed?.signedUrl, path: filePath };
  } catch (e: any) {
    return { error: e };
  }
}

export async function uploadMultipleReportMedia(userId: string, fileUris: string[]): Promise<{ urls: string[]; errors: string[] }>{
  const results = await Promise.allSettled(fileUris.map(uri => uploadReportMedia(userId, uri)));
  const urls: string[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (r.value.url) urls.push(r.value.url);
      else if (r.value.path) urls.push(r.value.path);
      else if (r.value.error) errors.push((r.value.error as any).message || String(r.value.error));
      else errors.push('Unknown upload error');
    } else {
      errors.push(r.reason?.message || 'Upload failed');
    }
  }
  return { urls, errors };
}
