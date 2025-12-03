// Type definitions
interface Report {
  id: string | number;
  user_id?: string | number;
  incident_type: string;
  incident_datetime: string;
  location: string;
  contact_number: string;
  patient_status: 'Alert' | 'Voice' | 'Pain' | 'Unresponsive' | 'No Patient';
  report_type?: 'official' | 'follow-up';
  uploaded_media: string[];
  description: string;
}

interface CreateReportData {
  incidentType: string;
  location: string;
  contactNumber: string;
  patientStatus: 'Alert' | 'Voice' | 'Pain' | 'Unresponsive' | 'No Patient';
  description: string;
  mediaUrls?: string[];
}

// Optimized API client - using only Supabase (removed dead code branches)
export const api = {
  reports: {
    getAll: async (userId: string | number): Promise<Report[]> => {
      const { db } = await import('../lib/supabase');
      const { data, error } = await db.getReports(userId.toString());
      if (error) throw new Error(error.message);
      return data || [];
    },

    getById: async (id: string | number): Promise<Report> => {
      const { db } = await import('../lib/supabase');
      const { data, error } = await db.getReport(id.toString());
      if (error) throw new Error(error.message);
      return data;
    },

    create: async (reportData: CreateReportData, userId: string | number): Promise<Report> => {
      const { db } = await import('../lib/supabase');

      const { data, error } = await db.createReport({
        user_id: userId.toString(),
        incident_type: reportData.incidentType,
        location: reportData.location,
        contact_number: reportData.contactNumber,
        patient_status: reportData.patientStatus,
        description: reportData.description,
        uploaded_media: reportData.mediaUrls || [],
        incident_datetime: new Date().toISOString(),
        status: 'PENDING' // Add default status
      });
      
      // Handle 429 rate limit error
      if (error) {
        if (error.status === 429 || error.code === 'RATE_LIMIT_EXCEEDED') {
          const rateLimitError: any = new Error(error.message || "You've reached your report limit. Please wait for the next hour.");
          rateLimitError.status = 429;
          rateLimitError.code = 'RATE_LIMIT_EXCEEDED';
          throw rateLimitError;
        }
        throw new Error(error.message);
      }
      return data;
    },

    update: async (id: string | number, updates: Partial<Report>): Promise<Report> => {
      const { db } = await import('../lib/supabase');
      const safeUpdates: any = { ...updates };
      if (safeUpdates.id !== undefined) delete safeUpdates.id;
      const { data, error } = await db.updateReport(id.toString(), safeUpdates);
      if (error) throw new Error(error.message);
      return data;
    },

    getHourlyStatus: async (userId: string | number): Promise<{ count: number; remaining: number; limitReached: boolean; limit: number }> => {
      const { db } = await import('../lib/supabase');
      const { data, error } = await db.getReportLimitStatus(userId.toString());
      if (error) throw new Error(error.message);
      return data || { count: 0, remaining: 3, limitReached: false, limit: 3 };
    },
  },
  users: {
    update: async (id: string | number, updates: { name?: string; barangay_position?: string; profile_pic?: string | null; contact_number?: string }) => {
      const { db } = await import('../lib/supabase');
      const safeUpdates: any = { ...updates };
      if (safeUpdates.profile_pic === null) delete safeUpdates.profile_pic;
      const { data, error } = await db.updateUser(id.toString(), safeUpdates);
      if (error) throw new Error(error.message);
      return data;
    },

    storePushToken: async (userId: string, token: string): Promise<void> => {
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase
        .from('users')
        .update({ expo_push_token: token })
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to store push token:', error);
        throw new Error(error.message);
      }
    }
  }
};