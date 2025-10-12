// Type definitions
interface Report {
  id: string | number;
  user_id?: string | number;
  incident_type: string;
  incident_datetime: string;
  location: string;
  urgency_tag: 'Low' | 'Moderate' | 'High';
  uploaded_media: string[];
  description: string;
}

interface CreateReportData {
  incidentType: string;
  location: string;
  urgency: 'Low' | 'Moderate' | 'High';
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
        urgency_tag: reportData.urgency,
        description: reportData.description,
        uploaded_media: reportData.mediaUrls || [],
        incident_datetime: new Date().toISOString()
      });
      if (error) throw new Error(error.message);
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