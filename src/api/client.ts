// Type definitions
interface Report {
  id: string | number;
  user_id?: string | number;
  incident_type: string;
  incident_datetime: string;
  location: string;
  urgency_tag?: 'Low' | 'Moderate' | 'High'; // Kept for backward compatibility
  patient_status: 'Alert' | 'Voice' | 'Pain' | 'Unresponsive';
  urgency_level: 'Low' | 'Moderate' | 'High';
  report_type?: 'official' | 'follow-up';
  uploaded_media: string[];
  description: string;
}

interface CreateReportData {
  incidentType: string;
  location: string;
  patientStatus: 'Alert' | 'Voice' | 'Pain' | 'Unresponsive';
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
      
      // Map patientStatus to urgency_level
      const urgencyLevel: 'Low' | 'Moderate' | 'High' = 
        reportData.patientStatus === 'Alert' ? 'Low' :
        reportData.patientStatus === 'Voice' ? 'Moderate' :
        reportData.patientStatus === 'Pain' || reportData.patientStatus === 'Unresponsive' ? 'High' : 'Low';
      
      const { data, error } = await db.createReport({
        user_id: userId.toString(),
        incident_type: reportData.incidentType,
        location: reportData.location,
        patient_status: reportData.patientStatus,
        urgency_level: urgencyLevel,
        description: reportData.description,
        uploaded_media: reportData.mediaUrls || [],
        incident_datetime: new Date().toISOString()
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
    update: async (id: string | number, updates: { name?: string; barangay_position?: string; profile_pic?: string | null }) => {
      const { db } = await import('../lib/supabase');
      const safeUpdates: any = { ...updates };
      if (safeUpdates.profile_pic === null) delete safeUpdates.profile_pic;
      const { data, error } = await db.updateUser(id.toString(), safeUpdates);
      if (error) throw new Error(error.message);
      return data;
    }
  }
};