const API_URL = 'http://localhost:4001/api';

interface EmergencyReport {
  id: string;
  type: string;
  description: string;
  location: string;
  status: 'pending' | 'in-progress' | 'resolved';
  reportedBy: string;
  createdAt: string;
  updatedAt: string;
}

export const api = {
  emergencyReports: {
    getAll: async (): Promise<EmergencyReport[]> => {
      const response = await fetch(`${API_URL}/emergency-reports`);
      if (!response.ok) throw new Error('Failed to fetch emergency reports');
      return response.json();
    },

    getById: async (id: string): Promise<EmergencyReport> => {
      const response = await fetch(`${API_URL}/emergency-reports/${id}`);
      if (!response.ok) throw new Error('Failed to fetch emergency report');
      return response.json();
    },

    create: async (report: Omit<EmergencyReport, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmergencyReport> => {
      const response = await fetch(`${API_URL}/emergency-reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report),
      });
      if (!response.ok) throw new Error('Failed to create emergency report');
      return response.json();
    },

    update: async (id: string, updates: Partial<EmergencyReport>): Promise<EmergencyReport> => {
      const response = await fetch(`${API_URL}/emergency-reports/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update emergency report');
      return response.json();
    },
  },
};