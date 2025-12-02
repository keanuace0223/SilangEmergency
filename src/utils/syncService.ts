import NetInfo from '@react-native-community/netinfo';
import { api } from '../api/client';
import { uploadMultipleReportMedia } from '../lib/supabase';
import { offlineStorage } from './offlineStorage';

export interface SyncEvent {
  type: 'sync_started' | 'sync_completed' | 'sync_failed' | 'report_synced' | 'report_failed' | 'network_changed';
  data?: any;
}

class SyncService {
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private syncInterval: any = null;
  private listeners: ((event: SyncEvent) => void)[] = [];

  constructor() {
    this.initializeNetworkListener();
  }

  // Initialize network state listener
  private initializeNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      if (wasOnline !== this.isOnline) {
        this.notifyListeners({
          type: 'network_changed',
          data: { isOnline: this.isOnline }
        });
        
        // Start sync when coming back online
        if (this.isOnline && !this.isSyncing) {
          this.startAutoSync();
        }
      }
    });
  }

  // Add event listener
  addListener(listener: (event: SyncEvent) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners
  private notifyListeners(event: SyncEvent) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in sync event listener:', error);
      }
    });
  }

  // Start automatic sync
  startAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sync immediately
    this.syncPendingReports();

    // Then sync every 10 seconds when online for faster sync
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncPendingReports();
      }
    }, 10000);
  }

  // Stop automatic sync
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Get current network status
  getNetworkStatus() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
    };
  }

  // Manual sync trigger
  async manualSync(): Promise<{ success: boolean; syncedCount: number; errorCount: number }> {
    if (!this.isOnline) {
      throw new Error('No internet connection available');
    }

    return await this.syncPendingReports();
  }

  // Sync all pending reports
  private async syncPendingReports(): Promise<{ success: boolean; syncedCount: number; errorCount: number }> {
    if (this.isSyncing || !this.isOnline) {
      return { success: false, syncedCount: 0, errorCount: 0 };
    }

    this.isSyncing = true;
    this.notifyListeners({ type: 'sync_started' });

    try {
      // Get both pending offline reports and syncing drafts
      const pendingReports = await offlineStorage.getPendingReports();
      const syncingDrafts = await offlineStorage.getDrafts().then(drafts => 
        drafts.filter(draft => draft.sync_status === 'syncing')
      );
      
      const allPendingItems = [...pendingReports, ...syncingDrafts];
      let syncedCount = 0;
      let errorCount = 0;

      for (const report of allPendingItems) {
        try {
          // Update status to syncing
          if (report.sync_status !== 'syncing') {
            if (report.isDraft) {
              // It's a draft
              await offlineStorage.updateDraft(report.id, { 
                sync_status: 'syncing',
                updated_at: new Date().toISOString()
              });
            } else {
              // It's an offline report
              await offlineStorage.updateReportSyncStatus(report.id, 'syncing');
            }
          }

          // Upload media files if any
          let mediaUrls: string[] = [];
          if (report.local_media_paths && report.local_media_paths.length > 0) {
            const { urls, errors } = await uploadMultipleReportMedia(report.user_id, report.local_media_paths);
            mediaUrls = urls;
            
            if (errors.length > 0) {
              console.warn('Some media uploads failed:', errors);
            }
          }

          // Create report data for API
          // Use stored patient_status; default to 'Alert' if missing
          const patientStatus: 'Alert' | 'Voice' | 'Pain' | 'Unresponsive' | 'No Patient' =
            (report.patient_status as any) || 'Alert';

          const reportData = {
            incidentType: report.incident_type as 'Fire' | 'Vehicular Accident' | 'Flood' | 'Earthquake' | 'Electrical',
            location: report.location,
            contactNumber: report.contact_number || '',
            patientStatus,
            description: report.description,
            mediaUrls,
          };

          // Submit to API
          await api.reports.create(reportData, report.user_id);

          // Mark as synced and handle based on type
          if (report.isDraft) {
            // It's a draft - delete it after successful sync
            await offlineStorage.deleteDraft(report.id);
          } else {
            // It's an offline report - remove it
            await offlineStorage.updateReportSyncStatus(report.id, 'synced');
            await offlineStorage.removeSyncedReport(report.id);
          }

          syncedCount++;
          this.notifyListeners({
            type: 'report_synced',
            data: { reportId: report.id, reportType: report.incident_type }
          });

        } catch (error) {
          console.error(`Failed to sync report ${report.id}:`, error);
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          if (report.isDraft) {
            // It's a draft
            await offlineStorage.updateDraft(report.id, { 
              sync_status: 'error',
              error_message: errorMessage,
              updated_at: new Date().toISOString()
            });
          } else {
            // It's an offline report
            await offlineStorage.updateReportSyncStatus(report.id, 'error', errorMessage);
          }
          
          errorCount++;
          this.notifyListeners({
            type: 'report_failed',
            data: { reportId: report.id, error: errorMessage }
          });
        }
      }

      // Update last sync time
      await offlineStorage.updateLastSyncTime();
      await offlineStorage.updateSyncStatus();

      const success = errorCount === 0;
      this.notifyListeners({
        type: success ? 'sync_completed' : 'sync_failed',
        data: { syncedCount, errorCount }
      });

      return { success, syncedCount, errorCount };

    } catch (error) {
      console.error('Sync process failed:', error);
      this.notifyListeners({
        type: 'sync_failed',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      return { success: false, syncedCount: 0, errorCount: 0 };
    } finally {
      this.isSyncing = false;
    }
  }

  // Retry failed reports
  async retryFailedReports(): Promise<{ success: boolean; syncedCount: number; errorCount: number }> {
    if (!this.isOnline) {
      throw new Error('No internet connection available');
    }

    // Reset error status for failed reports
    const failedReports = await offlineStorage.getOfflineReports();
    const errorReports = failedReports.filter(r => r.sync_status === 'error');
    
    for (const report of errorReports) {
      await offlineStorage.updateReportSyncStatus(report.id, 'pending');
    }

    return await this.syncPendingReports();
  }

  // Get sync statistics
  async getSyncStats() {
    const reports = await offlineStorage.getOfflineReports();
    const pendingCount = reports.filter(r => r.sync_status === 'pending').length;
    const syncingCount = reports.filter(r => r.sync_status === 'syncing').length;
    const errorCount = reports.filter(r => r.sync_status === 'error').length;
    const syncedCount = reports.filter(r => r.sync_status === 'synced').length;

    return {
      pending: pendingCount,
      syncing: syncingCount,
      error: errorCount,
      synced: syncedCount,
      total: reports.length,
    };
  }

  // Cleanup
  destroy() {
    this.stopAutoSync();
    this.listeners = [];
  }
}

// Create singleton instance
export const syncService = new SyncService();
