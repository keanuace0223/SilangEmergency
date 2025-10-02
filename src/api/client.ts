// For mobile device/emulator, use your computer's IP address instead of localhost
const API_URL = 'http://192.168.18.57:4001/api';

// Supabase configuration is read inside src/lib/supabase.ts via env vars

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

// Always use Supabase (disable local backend calls)
const USE_SUPABASE = true;

export const api = {
  reports: {
    getAll: async (userId: string | number = 1): Promise<Report[]> => {
      if (USE_SUPABASE) {
        const { db } = await import('../lib/supabase');
        const { data, error } = await db.getReports(userId.toString());
        if (error) throw new Error(error.message);
        return data || [];
      } else {
        const response = await fetch(`${API_URL}/reports?user_id=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch reports');
        return response.json();
      }
    },

    getById: async (id: string | number): Promise<Report> => {
      if (USE_SUPABASE) {
        const { db } = await import('../lib/supabase');
        const { data, error } = await db.getReport(id.toString());
        if (error) throw new Error(error.message);
        return data;
      } else {
        const response = await fetch(`${API_URL}/reports/${id}`);
        if (!response.ok) throw new Error('Failed to fetch report');
        return response.json();
      }
    },

    create: async (reportData: CreateReportData, userId: string | number = 1): Promise<Report> => {
      if (USE_SUPABASE) {
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
      } else {
        const response = await fetch(`${API_URL}/reports`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...reportData, userId }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create report');
        }
        return response.json();
      }
    },

    update: async (id: string | number, updates: Partial<Report>): Promise<Report> => {
      if (USE_SUPABASE) {
        const { db } = await import('../lib/supabase');
        const safeUpdates: any = { ...updates };
        // Ensure types match supabase Report (id must be string if present)
        if (safeUpdates.id !== undefined) delete safeUpdates.id;
        const { data, error } = await db.updateReport(id.toString(), safeUpdates);
        if (error) throw new Error(error.message);
        return data;
      } else {
        const response = await fetch(`${API_URL}/reports/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });
        if (!response.ok) throw new Error('Failed to update report');
        return response.json();
      }
    },
  },
  users: {
    update: async (id: string | number, updates: { name?: string; barangay_position?: string; profile_pic?: string | null }) => {
      if (USE_SUPABASE) {
        const { db } = await import('../lib/supabase');
        const safeUpdates: any = { ...updates };
        // Normalize profile_pic to undefined instead of null to match types
        if (safeUpdates.profile_pic === null) delete safeUpdates.profile_pic;
        const { data, error } = await db.updateUser(id.toString(), safeUpdates);
        if (error) throw new Error(error.message);
        return data;
      } else {
        const response = await fetch(`${API_URL}/users/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!response.ok) throw new Error('Failed to update user');
        return response.json();
      }
    }
  }
};