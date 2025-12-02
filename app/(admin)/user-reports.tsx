import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, Modal, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScaledText from '../../components/ScaledText';
import { adminApi } from '../../src/utils/adminApi';

type ModalAction = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
};

export default function AdminUserReportsScreen() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalIcon, setModalIcon] = useState<keyof typeof Ionicons.glyphMap>('information-circle');
  const [modalIconColor, setModalIconColor] = useState('#2563EB');
  const [modalActions, setModalActions] = useState<ModalAction[]>([
    {
      label: 'OK',
      onPress: () => setModalVisible(false),
      variant: 'primary',
    },
  ]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      if (userId) {
        const { reports } = await adminApi.getUserReports(String(userId), { page: 1, limit: 20 });
        setReports(reports || []);
      } else {
        const { reports } = await adminApi.getReports({ page: 1, limit: 20 });
        setReports(reports || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  const showModal = (
    title: string,
    message: string,
    icon: keyof typeof Ionicons.glyphMap,
    color: string,
    actions?: ModalAction[],
  ) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalIcon(icon);
    setModalIconColor(color);
    setModalActions(
      actions && actions.length > 0
        ? actions
        : [
            {
              label: 'OK',
              onPress: () => setModalVisible(false),
              variant: 'primary',
            },
          ],
    );
    setModalVisible(true);
  };

  useEffect(() => { load(); }, [load]);

  // Real-time updates via Supabase Realtime for admin
  useEffect(() => {
    // Dynamic import to avoid circular dependencies
    import('../../src/lib/supabase').then(({ supabase }) => {
    
      // Subscribe to INSERT events on reports table (all reports for admin)
      const channel = supabase
        .channel('admin-user-reports-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT', // Listen to new reports
            schema: 'public',
            table: 'reports',
          },
          (payload: any) => {
            // Refresh report list when new report is inserted
            load()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    })
  }, [load])

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
  };

  // Icon/color helpers (mirrors tabs screens)
  const getIncidentIcon = (type: string): any => {
    const iconMap: { [key: string]: string } = {
      'Fire': 'flame',
      'Vehicular Accident': 'car',
      'Flood': 'water',
      'Earthquake': 'earth',
      'Electrical': 'flash'
    };
    return (iconMap[type] || 'warning') as any;
  };

  const getIncidentColor = (type: string) => {
    const colorMap: { [key: string]: string } = {
      'Fire': '#FF6B35',
      'Vehicular Accident': '#FF4444',
      'Flood': '#4A90E2',
      'Earthquake': '#8B4513',
      'Electrical': '#F59E0B'
    };
    return colorMap[type] || '#3B82F6';
  };

  // Helper function to get AVPU display info
  const getPatientStatusInfo = (status: string) => {
    switch (status) {
      case 'Alert':
        return { icon: 'eye-outline', text: 'ALERT', color: '#10B981' };
      case 'Voice':
        return { icon: 'volume-medium-outline', text: 'VOICE', color: '#F59E0B' };
      case 'Pain':
        return { icon: 'alert-circle-outline', text: 'PAIN', color: '#EF4444' };
      case 'Unresponsive':
        return { icon: 'eye-off-outline', text: 'UNRESPONSIVE', color: '#EF4444' };
      default:
        // Fallback for old 'High'/'Moderate'/'Low' data
        if (status === 'High') return { icon: 'alert-circle-outline', text: 'HIGH', color: '#EF4444' };
        if (status === 'Moderate') return { icon: 'volume-medium-outline', text: 'MODERATE', color: '#F59E0B' };
        if (status === 'Low') return { icon: 'eye-outline', text: 'LOW', color: '#10B981' };
        return { icon: 'help-circle-outline', text: (status || 'N/A').toUpperCase(), color: '#6B7280' };
    }
  };

  const formatShortId = (id: any) => {
    if (id == null) return '';
    const s = String(id);
    if (s.includes('-')) return s.replace(/-/g, '').slice(0, 4).toUpperCase();
    return s.slice(0, 4).toUpperCase();
  };
  const handleDeleteReport = (report: any) => {
    showModal(
      'Delete report?',
      'Delete this report permanently?',
      'alert-circle',
      '#EF4444',
      [
        {
          label: 'Cancel',
          variant: 'secondary',
          onPress: () => setModalVisible(false),
        },
        {
          label: 'Delete',
          variant: 'danger',
          onPress: async () => {
            setModalVisible(false);
            try {
              await adminApi.deleteReport(String(report.id));
              setReports(prev => prev.filter(r => r.id !== report.id));
            } catch (error: any) {
              showModal(
                'Error',
                error?.message || 'Failed to delete report. Please try again.',
                'warning',
                '#EF4444',
              );
            }
          },
        },
      ],
    );
  };
  const renderReportItem = ({ item }: { item: any }) => {
    // Only show status tag for Vehicular Accident and Others incident types
    const shouldShowStatus = item.incident_type === 'Vehicular Accident' || item.incident_type === 'Others';
    const statusInfo = shouldShowStatus ? getPatientStatusInfo(item.patient_status || 'No Patient') : null;
    
    return (
      <TouchableOpacity activeOpacity={0.9} className="bg-white rounded-2xl border border-gray-100 p-4 mb-3" onPress={() => { setSelectedReport(item); setShowDetail(true); }} style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 }}>
        <View className="flex-row">
          <View className="w-12 h-12 rounded-xl bg-white items-center justify-center mr-4 shadow-sm">
            <Ionicons name={getIncidentIcon(item.incident_type)} size={24} color={getIncidentColor(item.incident_type)} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold text-gray-900" numberOfLines={1}>{item.incident_type}</Text>
              <View className="flex-row items-center">
                {statusInfo && (
                  <View className="px-2 py-1 rounded-full flex-row items-center" style={{ backgroundColor: statusInfo.color + 'E6' }}>
                    <Ionicons name={statusInfo.icon as any} size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
                    <Text className="text-[10px] font-bold" style={{ color: '#FFFFFF' }}>
                      {statusInfo.text}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => handleDeleteReport(item)}
                  className="ml-2 w-8 h-8 rounded-full bg-red-50 items-center justify-center border border-red-200"
                >
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>
          {item.description ? (
            <Text className="text-gray-600 text-xs mt-1" numberOfLines={2}>{item.description}</Text>
          ) : null}
          <View className="flex-row items-center mt-2">
            <Ionicons name="location" size={14} color="#4B5563" />
            <Text className="text-gray-500 text-xs ml-1" numberOfLines={1}>{item.location}</Text>
          </View>
        </View>
      </View>
      <View className="flex-row items-center justify-between mt-3">
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
          <Text className="text-gray-500 text-xs">REPORTED</Text>
        </View>
        <Text className="text-gray-400 text-xs">#{formatShortId(item.id)}</Text>
      </View>
    </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top','bottom']}>
      <View className="bg-white px-6 py-4 border-b border-gray-100">
        <ScaledText baseSize={20} className="font-bold text-gray-900">User Reports</ScaledText>
        <Text className="text-gray-600">Latest submitted reports</Text>
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#4A90E2" />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={renderReportItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#4A90E2"]} />}
          ListEmptyComponent={<Text className="text-center text-gray-500">No reports found.</Text>}
        />
      )}

      {/* Report Detail Modal (mirror of tabs report details) */}
      <Modal visible={showDetail} animationType="slide" onRequestClose={() => { setShowDetail(false); setSelectedReport(null); }}>
        <View className={`flex-1 bg-white`}>
          <View className={`px-4 py-4 border-b shadow-sm bg-white border-gray-100`}>
            <View className="flex-row items-center justify-between">
              <TouchableOpacity onPress={() => { setShowDetail(false); setSelectedReport(null); }} className="p-2">
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
              <Text className={`text-lg font-semibold text-gray-900`}>Report Details</Text>
              <View className="w-8" />
            </View>
          </View>

          {selectedReport && (
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
              <View className="flex-row items-center mb-6">
                <View className={`w-16 h-16 rounded-full items-center justify-center mr-4 shadow-sm bg-blue-50`}>
                  <Ionicons name={getIncidentIcon(selectedReport.incident_type) as any} size={32} color="#4A90E2" />
                </View>
                <View className="flex-1">
                  <Text className={`text-2xl font-bold mb-1 text-gray-900`}>{selectedReport.incident_type}</Text>
                  {(() => {
                    const statusInfo = getPatientStatusInfo(selectedReport.patient_status || 'No Patient');
                    return (
                      <View className="px-3 py-1 rounded-full self-start" style={{ backgroundColor: statusInfo.color + 'E6' }}>
                        <Text className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{statusInfo.text}</Text>
                      </View>
                    );
                  })()}
                </View>
              </View>

              <View className="mb-6">
                <Text className={`text-lg font-semibold mb-2 text-gray-900`}>Location</Text>
                <View className={`flex-row items-center p-4 rounded-xl bg-gray-50`}>
                  <Ionicons name="location" size={20} color="#4A90E2" />
                  <Text className={`text-base ml-2 text-gray-700`}>{selectedReport.location}</Text>
                </View>
              </View>

              <View className="mb-6">
                <Text className={`text-lg font-semibold mb-2 text-gray-900`}>Description</Text>
                <View className={`p-4 rounded-xl bg-gray-50`}>
                  <Text className={`text-base leading-6 text-gray-700`}>{selectedReport.description}</Text>
                </View>
              </View>

              {selectedReport.uploaded_media && selectedReport.uploaded_media.length > 0 && (
                <View className="mb-6">
                  <Text className={`text-lg font-semibold mb-2 text-gray-900`}>Attached Media</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {selectedReport.uploaded_media.map((mediaUrl: string, index: number) => (
                      <TouchableOpacity key={index} className={`w-20 h-20 rounded-lg overflow-hidden bg-gray-100`} onPress={() => { setSelectedImageIndex(index); setShowImageViewer(true); }}>
                        <Image source={{ uri: mediaUrl }} className="w-full h-full" resizeMode="cover" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View className="mb-6">
                <Text className={`text-lg font-semibold mb-2 text-gray-900`}>Report Information</Text>
                <View className={`p-4 rounded-xl bg-gray-50`}>
                  <View className="flex-row justify-between mb-2">
                    <Text className={'text-gray-600'}>Report ID:</Text>
                    <Text className={`font-medium text-gray-900`}>#{formatShortId(selectedReport.id)}</Text>
                  </View>
                  <View className="flex-row justify-between mb-2">
                    <Text className={'text-gray-600'}>Submitted:</Text>
                    <Text className={`font-medium text-gray-900`}>
                      {new Date(selectedReport.incident_datetime).toLocaleDateString()} at {new Date(selectedReport.incident_datetime).toLocaleTimeString()}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className={'text-gray-600'}>Status:</Text>
                    <Text className={`font-medium text-gray-900`}>REPORTED</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Fullscreen Image Viewer */}
      <Modal visible={showImageViewer} animationType="fade" onRequestClose={() => setShowImageViewer(false)} transparent>
        <View className="flex-1 bg-black">
          <View className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-50 pt-12 pb-4 px-4">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity onPress={() => setShowImageViewer(false)} className="p-2">
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text className="text-white text-lg font-semibold">{selectedImageIndex + 1} of {selectedReport?.uploaded_media?.length || 0}</Text>
              <View className="w-8" />
            </View>
          </View>
          <View className="flex-1 items-center justify-center">
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: selectedImageIndex * Dimensions.get('window').width, y: 0 }}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / Dimensions.get('window').width);
                setSelectedImageIndex(index);
              }}
            >
              {(selectedReport?.uploaded_media || []).map((imageUrl: string, index: number) => (
                <View key={index} className="w-full h-full" style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height }}>
                  <Image source={{ uri: imageUrl }} className="w-full h-full" style={{ resizeMode: 'contain' }} />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}


