import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useSync } from '../src/context/SyncContext';
import ScaledText from './ScaledText';

interface OfflineModeBannerProps {
  onRetryPress?: () => void;
  onManualSyncPress?: () => void;
}

const OfflineModeBanner: React.FC<OfflineModeBannerProps> = ({ 
  onRetryPress, 
  onManualSyncPress 
}) => {
  const { isOnline, isSyncing, pendingCount } = useSync();

  if (isOnline) {
    return null; // Don't show banner when online
  }

  return (
    <View className="bg-red-50 border-l-4 border-red-400 p-4 mx-4 mb-4 rounded-r-lg">
      <View className="flex-row items-start">
        <View className="flex-shrink-0">
          <Ionicons name="cloud-offline" size={20} color="#EF4444" />
        </View>
        <View className="ml-3 flex-1">
          <ScaledText baseSize={16} className="font-semibold text-red-800">
            Offline Mode
          </ScaledText>
          <ScaledText baseSize={14} className="text-red-700 mt-1">
            {pendingCount > 0 
              ? `${pendingCount} report${pendingCount > 1 ? 's' : ''} will sync when connection is restored`
              : 'Reports will be saved locally and synced when online'
            }
          </ScaledText>
          
          {pendingCount > 0 && (
            <View className="flex-row gap-2 mt-3">
              <TouchableOpacity
                onPress={onRetryPress}
                disabled={isSyncing}
                className="px-3 py-2 bg-red-100 rounded-lg"
                activeOpacity={0.7}
              >
                <ScaledText baseSize={12} className="font-semibold text-red-800">
                  Retry
                </ScaledText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onManualSyncPress}
                disabled={isSyncing}
                className="px-3 py-2 bg-red-200 rounded-lg"
                activeOpacity={0.7}
              >
                <ScaledText baseSize={12} className="font-semibold text-red-800">
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </ScaledText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

export default OfflineModeBanner;
