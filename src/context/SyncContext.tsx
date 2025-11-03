import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { offlineStorage, SyncStatus } from '../utils/offlineStorage';
import { SyncEvent, syncService } from '../utils/syncService';

interface SyncContextType {
  syncStatus: SyncStatus;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime?: string;
  manualSync: () => Promise<{ success: boolean; syncedCount: number; errorCount: number }>;
  retryFailedReports: () => Promise<{ success: boolean; syncedCount: number; errorCount: number }>;
  getSyncStats: () => Promise<{
    pending: number;
    syncing: number;
    error: number;
    synced: number;
    total: number;
  }>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    pendingCount: 0,
    isSyncing: false,
  });

  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | undefined>();

  // Load initial sync status
  useEffect(() => {
    const loadSyncStatus = async () => {
      try {
        const status = await offlineStorage.getSyncStatus();
        setSyncStatus(status);
        setIsOnline(status.isOnline);
        setIsSyncing(status.isSyncing);
        setPendingCount(status.pendingCount);
        setLastSyncTime(status.lastSyncTime);
      } catch (error) {
        console.error('Error loading sync status:', error);
      }
    };

    loadSyncStatus();
  }, []);

  // Set up sync service listeners
  useEffect(() => {
    const handleSyncEvent = (event: SyncEvent) => {
      switch (event.type) {
        case 'sync_started':
          setIsSyncing(true);
          setSyncStatus(prev => ({ ...prev, isSyncing: true }));
          break;
          
        case 'sync_completed':
        case 'sync_failed':
          setIsSyncing(false);
          setSyncStatus(prev => ({ ...prev, isSyncing: false }));
          // Refresh sync status
          refreshSyncStatus();
          break;
          
        case 'network_changed':
          const { isOnline: online } = event.data;
          setIsOnline(online);
          setSyncStatus(prev => ({ ...prev, isOnline: online }));
          break;
          
        case 'report_synced':
        case 'report_failed':
          // Refresh sync status when individual reports are processed
          refreshSyncStatus();
          break;
      }
    };

    const unsubscribe = syncService.addListener(handleSyncEvent);
    
    // Start auto-sync
    syncService.startAutoSync();

    return () => {
      unsubscribe();
      syncService.stopAutoSync();
    };
  }, []);

  const refreshSyncStatus = async () => {
    try {
      const status = await offlineStorage.getSyncStatus();
      setSyncStatus(status);
      setIsOnline(status.isOnline);
      setIsSyncing(status.isSyncing);
      setPendingCount(status.pendingCount);
      setLastSyncTime(status.lastSyncTime);
    } catch (error) {
      console.error('Error refreshing sync status:', error);
    }
  };

  const manualSync = async () => {
    try {
      const result = await syncService.manualSync();
      await refreshSyncStatus();
      return result;
    } catch (error) {
      console.error('Manual sync failed:', error);
      throw error;
    }
  };

  const retryFailedReports = async () => {
    try {
      const result = await syncService.retryFailedReports();
      await refreshSyncStatus();
      return result;
    } catch (error) {
      console.error('Retry failed reports failed:', error);
      throw error;
    }
  };

  const getSyncStats = async () => {
    try {
      return await syncService.getSyncStats();
    } catch (error) {
      console.error('Error getting sync stats:', error);
      return {
        pending: 0,
        syncing: 0,
        error: 0,
        synced: 0,
        total: 0,
      };
    }
  };

  const value: SyncContextType = {
    syncStatus,
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    manualSync,
    retryFailedReports,
    getSyncStats,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = (): SyncContextType => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};
