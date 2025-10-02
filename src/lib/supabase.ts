import { createClient } from '@supabase/supabase-js';


const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: async (key: string) => {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        return AsyncStorage.getItem(key);
      },
      setItem: async (key: string, value: string) => {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        return AsyncStorage.setItem(key, value);
      },
      removeItem: async (key: string) => {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        return AsyncStorage.removeItem(key);
      },
    },
  },
});

const AVATAR_BUCKET = process.env.EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET || 'avatars';

// Database types
export interface User {
  id: string;
  userid: string;
  name: string;
  barangay: string;
  barangay_position: string;
  profile_pic?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Report {
  id: string;
  user_id: string;
  incident_type: string;
  location: string;
  urgency_tag: 'Low' | 'Moderate' | 'High';
  description: string;
  uploaded_media: string[];
  incident_datetime: string;
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
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    return { data, error };
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
    const { data, error } = await supabase
      .from('users')
      .upsert(profile, { onConflict: 'id' })
      .select()
      .single();
    return { data, error };
  },

  // Reports
  getReports: async (userId: string) => {
    // Rely on RLS; no manual user_id filter
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('incident_datetime', { ascending: false });
    return { data, error };
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
    const { data, error } = await supabase
      .from('reports')
      .insert(reportData)
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

  deleteReport: async (id: string) => {
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', id);
    return { error };
  },

  getReportCount: async (userId: string) => {
    const { count, error } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    return { count, error };
  }
};

// Storage helpers
export async function uploadProfileImage(userId: string, fileUri: string): Promise<{ path?: string; signedUrl?: string; error?: Error }>{
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
