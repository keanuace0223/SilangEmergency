import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import ScaledText from './ScaledText';

interface ActiveSession {
  id: string;
  device_info?: {
    deviceName?: string;
    platform?: string;
    deviceType?: string;
  };
  ip_address?: string;
  last_activity: string;
  created_at: string;
}

interface MultiDeviceLoginModalProps {
  visible: boolean;
  onClose: () => void;
  onForceLogin?: () => void; // optional: when omitted, force login is disabled
  activeSessions: ActiveSession[];
  loading?: boolean;
}

const MultiDeviceLoginModal: React.FC<MultiDeviceLoginModalProps> = ({ 
  visible, 
  onClose, 
  onForceLogin, 
  activeSessions = [],
  loading = false 
}) => {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Unknown';
    }
  };

  const getDeviceDisplayName = (session: ActiveSession) => {
    if (session.device_info?.deviceName) {
      return session.device_info.deviceName;
    }
    if (session.device_info?.platform) {
      return `${session.device_info.platform} Device`;
    }
    return 'Unknown Device';
  };

  const getDeviceIcon = (session: ActiveSession): keyof typeof Ionicons.glyphMap => {
    const platform = session.device_info?.platform?.toLowerCase();
    const deviceType = session.device_info?.deviceType?.toLowerCase();
    
    if (deviceType === 'tablet') return 'tablet-portrait';
    if (platform === 'ios') return 'phone-portrait';
    if (platform === 'android') return 'phone-portrait';
    if (platform === 'web') return 'desktop';
    return 'desktop-outline';
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-md rounded-2xl bg-white p-6 max-h-4/5">
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View className="items-center mb-6">
              <View className="w-16 h-16 rounded-full items-center justify-center mb-3 bg-amber-50">
                <Ionicons name="warning" size={28} color="#F59E0B" />
              </View>
              <ScaledText baseSize={20} className="font-bold text-gray-900 mb-2 text-center">
                Multiple Device Login Detected
              </ScaledText>
              <ScaledText baseSize={14} className="text-gray-600 text-center leading-5">
                Your account is already signed in on {activeSessions.length} other device{activeSessions.length > 1 ? 's' : ''}.
                For security reasons, only one active session is allowed. Please sign out from the other device first, then try again.
              </ScaledText>
            </View>

            {/* Active Sessions List */}
            {activeSessions.length > 0 && (
              <View className="mb-6">
                <ScaledText baseSize={14} className="font-semibold text-gray-900 mb-3">
                  Active Sessions:
                </ScaledText>
                {activeSessions.map((session, index) => (
                  <View key={session.id} className="bg-gray-50 rounded-lg p-3 mb-2">
                    <View className="flex-row items-center mb-2">
                      <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-3">
                        <Ionicons name={getDeviceIcon(session)} size={16} color="#2563EB" />
                      </View>
                      <View className="flex-1">
                        <ScaledText baseSize={13} className="font-medium text-gray-900">
                          {getDeviceDisplayName(session)}
                        </ScaledText>
                        {session.ip_address && (
                          <ScaledText baseSize={11} className="text-gray-500">
                            IP: {session.ip_address}
                          </ScaledText>
                        )}
                      </View>
                    </View>
                    <View className="ml-11">
                      <ScaledText baseSize={11} className="text-gray-500">
                        Last active: {formatDate(session.last_activity)}
                      </ScaledText>
                      <ScaledText baseSize={11} className="text-gray-500">
                        Signed in: {formatDate(session.created_at)}
                      </ScaledText>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Security Notice */}
            <View className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-100">
              <View className="flex-row items-start">
                <Ionicons name="information-circle" size={16} color="#2563EB" style={{ marginRight: 8, marginTop: 2 }} />
                <View className="flex-1">
                  <ScaledText baseSize={12} className="text-blue-800 font-medium mb-1">
                    What to do
                  </ScaledText>
                  <ScaledText baseSize={11} className="text-blue-700 leading-4">
                    Open the other device and sign out, or wait for an admin to end the session.
                  </ScaledText>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View className="flex-row gap-3 mt-2">
            <TouchableOpacity 
              onPress={onClose} 
              className="flex-1 rounded-xl py-3 items-center bg-gray-100"
              disabled={loading}
            >
              <ScaledText baseSize={14} className="text-gray-800 font-medium">
                OK
              </ScaledText>
            </TouchableOpacity>
            {onForceLogin ? (
              <TouchableOpacity 
                onPress={onForceLogin} 
                className="flex-1 rounded-xl py-3 items-center bg-red-500"
                disabled={loading}
              >
                {loading ? (
                  <View className="flex-row items-center">
                    <Ionicons name="refresh" size={16} color="white" style={{ marginRight: 6 }} />
                    <ScaledText baseSize={14} className="text-white font-medium">
                      Signing In...
                    </ScaledText>
                  </View>
                ) : (
                  <ScaledText baseSize={14} className="text-white font-medium">
                    Sign In Anyway
                  </ScaledText>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default MultiDeviceLoginModal;
