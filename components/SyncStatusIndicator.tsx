import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { useSync } from '../src/context/SyncContext';
import ScaledText from './ScaledText';

interface SyncStatusIndicatorProps {
  onPress?: () => void;
  showDetails?: boolean;
  compact?: boolean;
}

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ 
  onPress, 
  showDetails = false, 
  compact = false 
}) => {
  const { isOnline, isSyncing, pendingCount, lastSyncTime } = useSync();

  const getStatusColor = () => {
    if (!isOnline) return '#EF4444'; // Red for offline
    if (isSyncing) return '#F59E0B'; // Yellow for syncing
    if (pendingCount > 0) return '#F59E0B'; // Yellow for pending
    return '#10B981'; // Green for synced
  };

  const getStatusIcon = () => {
    if (!isOnline) return 'cloud-offline';
    if (isSyncing) return 'sync';
    if (pendingCount > 0) return 'time';
    return 'checkmark-circle';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (pendingCount > 0) return `${pendingCount} Pending`;
    return 'Synced';
  };

  const getStatusDescription = () => {
    if (!isOnline) return 'No internet connection';
    if (isSyncing) return 'Uploading reports...';
    if (pendingCount > 0) return `${pendingCount} report${pendingCount > 1 ? 's' : ''} waiting to sync`;
    if (lastSyncTime) {
      const lastSync = new Date(lastSyncTime);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60));
      
      if (diffMinutes < 1) return 'Just synced';
      if (diffMinutes < 60) return `Synced ${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `Synced ${diffHours}h ago`;
      return `Synced ${Math.floor(diffHours / 24)}d ago`;
    }
    return 'All reports synced';
  };

  const statusColor = getStatusColor();
  const statusIcon = getStatusIcon();
  const statusText = getStatusText();
  const statusDescription = getStatusDescription();

  if (compact) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className="flex-row items-center px-3 py-2 rounded-full"
        style={{ backgroundColor: `${statusColor}20` }}
      >
        {isSyncing ? (
          <ActivityIndicator size="small" color={statusColor} style={{ marginRight: 6 }} />
        ) : (
          <Ionicons name={statusIcon as any} size={16} color={statusColor} style={{ marginRight: 6 }} />
        )}
        <ScaledText baseSize={12} className="font-semibold" style={{ color: statusColor }}>
          {statusText}
        </ScaledText>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <View 
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: `${statusColor}20` }}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={statusColor} />
            ) : (
              <Ionicons name={statusIcon as any} size={20} color={statusColor} />
            )}
          </View>
          <View className="flex-1">
            <ScaledText baseSize={16} className="font-semibold text-gray-900">
              {statusText}
            </ScaledText>
            {showDetails && (
              <ScaledText baseSize={14} className="text-gray-600 mt-1">
                {statusDescription}
              </ScaledText>
            )}
          </View>
        </View>
        {onPress && (
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        )}
      </View>
    </TouchableOpacity>
  );
};

export default SyncStatusIndicator;
