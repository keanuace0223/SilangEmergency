// For mobile device/emulator, use your computer's IP address instead of localhost
const API_URL = 'http://192.168.18.57:4001/api';

interface Report {
  id: number;
  user_id?: number;
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

export const api = {
  reports: {
    getAll: async (userId: number = 1): Promise<Report[]> => {
      const response = await fetch(`${API_URL}/reports?user_id=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    },

    getById: async (id: number): Promise<Report> => {
      const response = await fetch(`${API_URL}/reports/${id}`);
      if (!response.ok) throw new Error('Failed to fetch report');
      return response.json();
    },

    create: async (reportData: CreateReportData, userId: number = 1): Promise<Report> => {
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
    },

    update: async (id: number, updates: Partial<Report>): Promise<Report> => {
      const response = await fetch(`${API_URL}/reports/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update report');
      return response.json();
    },
  },
  users: {
    update: async (id: number, updates: { name?: string; barangay_position?: string; profile_pic?: string | null }) => {
      const response = await fetch(`${API_URL}/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update user');
      return response.json();
    }
  }
};