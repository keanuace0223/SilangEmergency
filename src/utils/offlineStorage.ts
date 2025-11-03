import { Report } from '../lib/supabase';

// Global type declarations
declare const window: any;
declare const navigator: any;

// Platform detection for storage
const isWeb = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
const isReactNative = typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative';

// Lazy import AsyncStorage to avoid web issues
let AsyncStorage: any = null;
if (isReactNative) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
}

export interface OfflineReport extends Omit<Report, 'id' | 'created_at' | 'updated_at'> {
  id: string; // Local temporary ID
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'syncing' | 'synced' | 'error';
  local_media_paths?: string[]; // Local file paths for offline media
  sync_attempts?: number;
  last_sync_attempt?: string;
  error_message?: string;
  isDraft?: boolean; // Flag to distinguish drafts from offline reports
}

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSyncTime?: string;
  isSyncing: boolean;
}

const STORAGE_KEYS = {
  OFFLINE_REPORTS: 'offline_reports',
  DRAFTS: 'drafts',
  SYNC_STATUS: 'sync_status',
  LAST_SYNC_TIME: 'last_sync_time',
} as const;

class OfflineStorageManager {
  // Platform-specific storage methods
  private async getStorageItem(key: string): Promise<string | null> {
    try {
      if (isWeb && typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      } else if (isReactNative && AsyncStorage) {
        return await AsyncStorage.getItem(key);
      } else {
        // Fallback for Node.js environments
        return null;
      }
    } catch (error) {
      console.warn('Storage getItem error:', error);
      return null;
    }
  }

  private async setStorageItem(key: string, value: string): Promise<void> {
    try {
      if (isWeb && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      } else if (isReactNative && AsyncStorage) {
        await AsyncStorage.setItem(key, value);
      }
      // No-op for Node.js environments
    } catch (error) {
      console.warn('Storage setItem error:', error);
    }
  }

  private async removeStorageItem(key: string): Promise<void> {
    try {
      if (isWeb && typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      } else if (isReactNative && AsyncStorage) {
        await AsyncStorage.removeItem(key);
      }
      // No-op for Node.js environments
    } catch (error) {
      console.warn('Storage removeItem error:', error);
    }
  }

  // Save a report offline
  async saveOfflineReport(report: Omit<OfflineReport, 'id' | 'created_at' | 'updated_at' | 'sync_status' | 'sync_attempts' | 'isDraft'>): Promise<string> {
    try {
      const offlineReport: OfflineReport = {
        ...report,
        id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
        isDraft: false, // Mark as offline report, not draft
      };

      const existingReports = await this.getOfflineReports();
      const updatedReports = [...existingReports, offlineReport];
      
      await this.setStorageItem(STORAGE_KEYS.OFFLINE_REPORTS, JSON.stringify(updatedReports));
      
      // Update sync status
      await this.updateSyncStatus();
      
      return offlineReport.id;
    } catch (error) {
      console.error('Error saving offline report:', error);
      throw new Error('Failed to save report offline');
    }
  }

  // Get all offline reports
  async getOfflineReports(): Promise<OfflineReport[]> {
    try {
      const data = await this.getStorageItem(STORAGE_KEYS.OFFLINE_REPORTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting offline reports:', error);
      return [];
    }
  }

  // Get pending reports (not yet synced)
  async getPendingReports(): Promise<OfflineReport[]> {
    const reports = await this.getOfflineReports();
    return reports.filter(report => report.sync_status === 'pending' || report.sync_status === 'error');
  }

  // Update report sync status
  async updateReportSyncStatus(
    reportId: string, 
    status: OfflineReport['sync_status'],
    errorMessage?: string
  ): Promise<void> {
    try {
      const reports = await this.getOfflineReports();
      const reportIndex = reports.findIndex(r => r.id === reportId);
      
      if (reportIndex !== -1) {
        reports[reportIndex].sync_status = status;
        reports[reportIndex].updated_at = new Date().toISOString();
        
        if (status === 'syncing') {
          reports[reportIndex].sync_attempts = (reports[reportIndex].sync_attempts || 0) + 1;
          reports[reportIndex].last_sync_attempt = new Date().toISOString();
        }
        
        if (errorMessage) {
          reports[reportIndex].error_message = errorMessage;
        }
        
        await this.setStorageItem(STORAGE_KEYS.OFFLINE_REPORTS, JSON.stringify(reports));
        await this.updateSyncStatus();
      }
    } catch (error) {
      console.error('Error updating report sync status:', error);
    }
  }

  // Remove synced reports
  async removeSyncedReport(reportId: string): Promise<void> {
    try {
      const reports = await this.getOfflineReports();
      const filteredReports = reports.filter(r => r.id !== reportId);
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_REPORTS, JSON.stringify(filteredReports));
      await this.updateSyncStatus();
    } catch (error) {
      console.error('Error removing synced report:', error);
    }
  }

  // Update sync status
  async updateSyncStatus(): Promise<void> {
    try {
      const allReports = await this.getOfflineReports();
      const pendingReports = allReports.filter(r => r.sync_status === 'pending');
      const syncingReports = allReports.filter(r => r.sync_status === 'syncing');
      const errorReports = allReports.filter(r => r.sync_status === 'error');
      
      const syncStatus: SyncStatus = {
        isOnline: true, // This will be updated by the sync service
        pendingCount: pendingReports.length + errorReports.length, // Include error reports as pending
        isSyncing: syncingReports.length > 0,
      };

      await this.setStorageItem(STORAGE_KEYS.SYNC_STATUS, JSON.stringify(syncStatus));
    } catch (error) {
      console.error('Error updating sync status:', error);
    }
  }

  // Get sync status
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const lastSyncTime = await this.getStorageItem(STORAGE_KEYS.LAST_SYNC_TIME);
      
      // Always recalculate from actual reports to ensure accuracy
      const allReports = await this.getOfflineReports();
      const pendingReports = allReports.filter(r => r.sync_status === 'pending');
      const syncingReports = allReports.filter(r => r.sync_status === 'syncing');
      const errorReports = allReports.filter(r => r.sync_status === 'error');
      
      const syncStatus: SyncStatus = {
        isOnline: true, // This will be updated by the sync service
        pendingCount: pendingReports.length + errorReports.length,
        isSyncing: syncingReports.length > 0,
        lastSyncTime: lastSyncTime || undefined,
      };
      
      return syncStatus;
    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        isOnline: true,
        pendingCount: 0,
        isSyncing: false,
      };
    }
  }

  // Update last sync time
  async updateLastSyncTime(): Promise<void> {
    try {
      const now = new Date().toISOString();
      await this.setStorageItem(STORAGE_KEYS.LAST_SYNC_TIME, now);
    } catch (error) {
      console.error('Error updating last sync time:', error);
    }
  }

  // Draft management methods
  async saveDraft(draft: Omit<OfflineReport, 'id' | 'created_at' | 'updated_at' | 'sync_status' | 'sync_attempts' | 'isDraft'>): Promise<string> {
    try {
      const draftReport: OfflineReport = {
        ...draft,
        id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending', // Drafts start as pending
        sync_attempts: 0,
        isDraft: true, // Mark as draft
      };

      const existingDrafts = await this.getDrafts();
      const updatedDrafts = [...existingDrafts, draftReport];
      
      await this.setStorageItem(STORAGE_KEYS.DRAFTS, JSON.stringify(updatedDrafts));
      
      return draftReport.id;
    } catch (error) {
      console.error('Error saving draft:', error);
      throw new Error('Failed to save draft');
    }
  }

  async getDrafts(): Promise<OfflineReport[]> {
    try {
      const data = await this.getStorageItem(STORAGE_KEYS.DRAFTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting drafts:', error);
      return [];
    }
  }

  async updateDraft(id: string, updates: Partial<OfflineReport>): Promise<void> {
    try {
      const drafts = await this.getDrafts();
      const draftIndex = drafts.findIndex(d => d.id === id);
      
      if (draftIndex !== -1) {
        drafts[draftIndex] = {
          ...drafts[draftIndex],
          ...updates,
          updated_at: new Date().toISOString(),
        };
        
        await this.setStorageItem(STORAGE_KEYS.DRAFTS, JSON.stringify(drafts));
      }
    } catch (error) {
      console.error('Error updating draft:', error);
    }
  }

  async deleteDraft(id: string): Promise<void> {
    try {
      const drafts = await this.getDrafts();
      const filteredDrafts = drafts.filter(d => d.id !== id);
      await this.setStorageItem(STORAGE_KEYS.DRAFTS, JSON.stringify(filteredDrafts));
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  }

  async submitDraft(id: string): Promise<void> {
    try {
      const drafts = await this.getDrafts();
      const draft = drafts.find(d => d.id === id);
      
      if (draft) {
        // Update draft status to syncing and add sync fields
        const updatedDraft = {
          ...draft,
          sync_status: 'syncing' as const,
          sync_attempts: 0,
          updated_at: new Date().toISOString(),
        };
        
        // Update the draft in place (don't move to offline reports)
        await this.updateDraft(id, updatedDraft);
      }
    } catch (error) {
      console.error('Error submitting draft:', error);
      throw error;
    }
  }

  // Clear all offline data (for testing or reset)
  async clearAllOfflineData(): Promise<void> {
    try {
      await this.removeStorageItem(STORAGE_KEYS.OFFLINE_REPORTS);
      await this.removeStorageItem(STORAGE_KEYS.DRAFTS);
      await this.removeStorageItem(STORAGE_KEYS.SYNC_STATUS);
      await this.removeStorageItem(STORAGE_KEYS.LAST_SYNC_TIME);
    } catch (error) {
      console.error('Error clearing offline data:', error);
    }
  }

  // Get offline report by ID
  async getOfflineReportById(id: string): Promise<OfflineReport | null> {
    try {
      const reports = await this.getOfflineReports();
      return reports.find(r => r.id === id) || null;
    } catch (error) {
      console.error('Error getting offline report by ID:', error);
      return null;
    }
  }

  // Update offline report
  async updateOfflineReport(id: string, updates: Partial<OfflineReport>): Promise<void> {
    try {
      const reports = await this.getOfflineReports();
      const reportIndex = reports.findIndex(r => r.id === id);
      
      if (reportIndex !== -1) {
        reports[reportIndex] = {
          ...reports[reportIndex],
          ...updates,
          updated_at: new Date().toISOString(),
        };
        
        await this.setStorageItem(STORAGE_KEYS.OFFLINE_REPORTS, JSON.stringify(reports));
        await this.updateSyncStatus();
      }
    } catch (error) {
      console.error('Error updating offline report:', error);
    }
  }
}

export const offlineStorage = new OfflineStorageManager();
