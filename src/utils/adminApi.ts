
import { createClient } from '@supabase/supabase-js';

// Create admin client with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://bhcecrbyknorjzkjazxu.supabase.co',
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoY2VjcmJ5a25vcmp6a2phenh1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTIwNjA0MywiZXhwIjoyMDc0NzgyMDQzfQ.-LqHm9_6n_eYFSYmEtvRnuGOXV--vU-p13CSoOJwP0g',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export interface AdminUser {
  id: string;
  userid: string;
  name: string;
  barangay: string;
  barangay_position: string;
  profile_pic?: string;
  created_at?: string;
  reportCount?: number;
}

export interface CreateUserRequest {
  userid: string;
  name: string;
  barangay: string;
  barangay_position: string;
  password: string;
}

export interface UpdateUserRequest {
  name: string;
  barangay: string;
  barangay_position: string;
}

export interface UsersResponse {
  users: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface AdminStats {
  totalUsers: number;
  totalReports: number;
  recentReports: number;
  barangayStats: Record<string, number>;
  usersByBarangay: {
    barangay: string;
    userCount: number;
  }[];
}

class AdminApiService {
  // Get all users with pagination and filters
  async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    barangay?: string;
    position?: string;
    includeReports?: boolean;
  } = {}): Promise<UsersResponse> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 20;
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from('users')
        .select('id, userid, name, barangay, barangay_position, profile_pic, created_at', { count: 'exact' });

      // Apply filters
      if (params.search) {
        query = query.or(`name.ilike.%${params.search}%,userid.ilike.%${params.search}%`);
      }
      if (params.barangay) {
        query = query.eq('barangay', params.barangay);
      }
      if (params.position) {
        query = query.eq('barangay_position', params.position);
      }

      // Apply pagination and ordering
      const { data: users, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      // If includeReports is true, get report counts for each user
      let usersWithReports = users || [];
      if (params.includeReports && users && users.length > 0) {
        const userIds = users.map(user => user.id);
        
        // Get report counts for each user
        const { data: reportCounts, error: reportError } = await supabaseAdmin
          .from('reports')
          .select('user_id')
          .in('user_id', userIds);

        if (!reportError && reportCounts) {
          // Count reports per user
          const reportCountMap = reportCounts.reduce((acc: Record<string, number>, report: any) => {
            acc[report.user_id] = (acc[report.user_id] || 0) + 1;
            return acc;
          }, {});

          // Add report count to each user
          usersWithReports = users.map((user: any) => ({
            ...user,
            reportCount: reportCountMap[user.id] || 0
          }));
        }
      }

      // Get total pages
      const totalPages = Math.ceil((count || 0) / limit);

      return {
        users: usersWithReports,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  // Create new user
  async createUser(userData: CreateUserRequest): Promise<{ success: boolean; user: AdminUser }> {
    try {
      // First create the auth user in Supabase
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: `${userData.userid}@login.local`,
        password: userData.password,
        email_confirm: true
      });

      if (authError) {
        throw new Error(`Failed to create auth user: ${authError.message}`);
      }

      if (!authUser.user) {
        throw new Error('Failed to create auth user');
      }

      // Then create the user profile
      const { data: profileUser, error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUser.user.id,
          userid: userData.userid,
          name: userData.name,
          barangay: userData.barangay,
          barangay_position: userData.barangay_position
        })
        .select()
        .single();

      if (profileError) {
        // If profile creation fails, try to delete the auth user
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        throw new Error(`Failed to create user profile: ${profileError.message}`);
      }

      return {
        success: true,
        user: profileUser
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Update user
  async updateUser(userId: string, userData: UpdateUserRequest): Promise<{ success: boolean; user: AdminUser }> {
    try {
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .update({
          name: userData.name,
          barangay: userData.barangay,
          barangay_position: userData.barangay_position
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update user: ${error.message}`);
      }

      return {
        success: true,
        user
      };
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Delete user
  async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // First delete the user profile
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);

      if (profileError) {
        throw new Error(`Failed to delete user profile: ${profileError.message}`);
      }

      // Then delete the auth user
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (authError) {
        console.warn('Failed to delete auth user:', authError.message);
        // Don't throw error here as profile is already deleted
      }

      return {
        success: true,
        message: 'User deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // Reset user password
  async resetPassword(userId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword
      });

      if (error) {
        throw new Error(`Failed to reset password: ${error.message}`);
      }

      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }

  // Get admin dashboard stats
  async getStats(): Promise<AdminStats> {
    try {
      // Get total users count
      const { count: totalUsers, error: usersError } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (usersError) throw usersError;

      // Get total reports count
      const { count: totalReports, error: reportsError } = await supabaseAdmin
        .from('reports')
        .select('*', { count: 'exact', head: true });

      if (reportsError) throw reportsError;

      // Get recent reports (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: recentReports, error: recentError } = await supabaseAdmin
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (recentError) throw recentError;

      // Get users by barangay
      const { data: usersByBarangay, error: barangayError } = await supabaseAdmin
        .from('users')
        .select('barangay')
        .not('barangay', 'is', null);

      if (barangayError) throw barangayError;

      // Count users by barangay
      const barangayStats: Record<string, number> = {};
      const usersByBarangayArray: { barangay: string; userCount: number }[] = [];

      if (usersByBarangay) {
        usersByBarangay.forEach((user: any) => {
          if (user.barangay) {
            barangayStats[user.barangay] = (barangayStats[user.barangay] || 0) + 1;
          }
        });

        Object.entries(barangayStats).forEach(([barangay, count]) => {
          usersByBarangayArray.push({ barangay, userCount: count });
        });
      }

      return {
        totalUsers: totalUsers || 0,
        totalReports: totalReports || 0,
        recentReports: recentReports || 0,
        barangayStats,
        usersByBarangay: usersByBarangayArray
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  }

  // Get list of barangays
  async getBarangays(): Promise<{ barangays: string[] }> {
    try {
      const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('barangay')
        .not('barangay', 'is', null);

      if (error) throw error;

      // Get unique barangays
      const uniqueBarangays = [...new Set(users?.map((user: any) => user.barangay).filter(Boolean) || [])] as string[];

      return {
        barangays: uniqueBarangays.sort()
      };
    } catch (error) {
      console.error('Error fetching barangays:', error);
      throw error;
    }
  }

  // Get reports for a specific user
  async getUserReports(userId: string, params: {
    page?: number;
    limit?: number;
  } = {}): Promise<{
    user: { id: string; userid: string; name: string; barangay: string };
    reports: any[];
    pagination: any;
  }> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 10;
      const offset = (page - 1) * limit;

      // Get user info
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, userid, name, barangay')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // Get user's reports
      const { data: reports, error: reportsError, count } = await supabaseAdmin
        .from('reports')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (reportsError) throw reportsError;

      const totalPages = Math.ceil((count || 0) / limit);

      return {
        user,
        reports: reports || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching user reports:', error);
      throw error;
    }
  }

  // Get all reports with filters
  async getReports(params: {
    page?: number;
    limit?: number;
    search?: string;
    barangay?: string;
    urgency?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<{
    reports: any[];
    pagination: any;
  }> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 20;
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from('reports')
        .select(`
          id, user_id, incident_type, location, urgency_tag, description, uploaded_media, incident_datetime, created_at,
          users:user_id (
            userid,
            name,
            barangay
          )
        `, { count: 'exact' });

      // Apply filters
      if (params.search) {
        query = query.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%`);
      }
      if (params.urgency) {
        query = query.eq('urgency', params.urgency);
      }
      if (params.startDate) {
        query = query.gte('created_at', params.startDate);
      }
      if (params.endDate) {
        query = query.lte('created_at', params.endDate);
      }

      // Apply pagination and ordering
      const { data: reports, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Filter by barangay if specified (after join)
      let filteredReports = reports || [];
      if (params.barangay) {
        filteredReports = filteredReports.filter((report: any) => 
          report.users?.barangay === params.barangay
        );
      }

      const totalPages = Math.ceil((count || 0) / limit);

      return {
        reports: filteredReports,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching reports:', error);
      throw error;
    }
  }

  // Active sessions joined with users
  async getActiveSessions(params: { search?: string } = {}): Promise<{ id: string; userid: string; name: string; barangay: string; last_activity: string }[]> {
    const { data, error } = await supabaseAdmin
      .from('user_sessions')
      .select('last_activity, users: user_id ( id, userid, name, barangay )')
      .eq('is_active', true)
      .order('last_activity', { ascending: false });
    if (error) throw error;
    let rows = (data || []).map((r: any) => ({
      id: r.users?.id,
      userid: r.users?.userid,
      name: r.users?.name,
      barangay: r.users?.barangay,
      last_activity: r.last_activity,
    }));
    if (params.search) {
      const q = params.search.toLowerCase();
      rows = rows.filter(r => (r.name || '').toLowerCase().includes(q) || (r.userid || '').toLowerCase().includes(q) || (r.barangay || '').toLowerCase().includes(q));
    }
    return rows;
  }

  // Reset user report limit by moving their recent reports' created_at timestamps to 2 hours ago
  async resetUserReportLimit(userId: string): Promise<{ success: boolean; count: number }> {
    try {
      // Calculate timestamps
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago

      // Find all reports created in the last hour
      const { data: reports, error: fetchError } = await supabaseAdmin
        .from('reports')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', oneHourAgo.toISOString());

      if (fetchError) {
        throw new Error(`Failed to fetch reports: ${fetchError.message}`);
      }

      if (!reports || reports.length === 0) {
        return { success: true, count: 0 };
      }

      // Update all found reports to have created_at = 2 hours ago
      // This effectively removes them from the hourly count
      const reportIds = reports.map(r => r.id);
      const { error: updateError } = await supabaseAdmin
        .from('reports')
        .update({ created_at: twoHoursAgo.toISOString() })
        .in('id', reportIds);

      if (updateError) {
        throw new Error(`Failed to update reports: ${updateError.message}`);
      }

      return {
        success: true,
        count: reports.length
      };
    } catch (error) {
      console.error('Error resetting user report limit:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const adminApi = new AdminApiService();
