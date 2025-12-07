import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, Modal, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScaledText from '../../components/ScaledText';
import { Body, Caption, Subtitle } from '../../components/Typography';
import { adminApi } from '../../src/utils/adminApi';


export default function AdminUserReportsScreen() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

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
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };
  const renderReportItem = ({ item }: { item: any }) => {
    const statusInfo = getPatientStatusInfo(item.patient_status || 'No Patient');
    const statusKey = String(item.status) as keyof typeof statusMap;
    const statusMap = {
      'PENDING': { text: 'SENT', color: '#6B7280', backgroundColor: '#F3F4F6' },
      'ACKNOWLEDGED': { text: 'RECEIVED', color: '#D97706', backgroundColor: '#FEF3C7' },
      'ON_GOING': { text: 'RESPONDERS ON WAY', color: '#EA580C', backgroundColor: '#FFEDD5' },
      'RESOLVED': { text: 'RESOLVED', color: '#16A34A', backgroundColor: '#DCFCE7' },
      'DECLINED': { text: 'RECORDED', color: '#0EA5E9', backgroundColor: '#E0F2FE' },
    };
    const badgeInfo = statusMap[statusKey] || { text: (item.status || 'N/A').toUpperCase(), color: '#6B7280', backgroundColor: '#F3F4F6' };

    return (
      <TouchableOpacity
        onPress={() => { setSelectedReport(item); setShowDetail(true); }}
        activeOpacity={0.85}
        className="mx-1 mb-3"
      >
        <View
          className="bg-white rounded-2xl border border-gray-100 shadow-sm"
          style={{
            borderLeftWidth: 4,
            borderLeftColor: getIncidentColor(item.incident_type),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 3,
            elevation: 2,
          }}
        >
          <View className="px-4 py-3">
            <View className="flex-row items-start justify-between">
              <View className="flex-row items-center flex-1">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: getIncidentColor(item.incident_type) + '1A' }}
                >
                  <Ionicons
                    name={getIncidentIcon(item.incident_type) as any}
                    size={20}
                    color={getIncidentColor(item.incident_type)}
                  />
                </View>
                <View className="flex-1">
                  <Subtitle className="text-lg font-bold" style={{ color: '#111827' }} numberOfLines={1}>
                    {item.incident_type}
                  </Subtitle>
                </View>
              </View>
              <Caption className="text-xs" style={{ color: '#9CA3AF', marginLeft: 8 }}>
                {formatTimestamp(item.incident_datetime || item.created_at)}
              </Caption>
            </View>

            {item.description ? (
              <Body className="mt-2 text-sm" style={{ color: '#4B5563' }} numberOfLines={2}>
                {item.description}
              </Body>
            ) : null}

            <View className="mt-3 flex-row items-center justify-between">
              <View
                className="px-2.5 py-1 rounded-full"
                style={{ backgroundColor: badgeInfo.backgroundColor }}
              >
                <Caption className="font-semibold" style={{ color: badgeInfo.color, fontSize: 10 }}>
                  {badgeInfo.text}
                </Caption>
              </View>

              {statusInfo && (
                <View
                  className="flex-row items-center px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: statusInfo.color + '1A' }}
                >
                  <Ionicons name={statusInfo.icon as any} size={11} color={statusInfo.color} style={{ marginRight: 4 }} />
                  <Caption className="font-semibold" style={{ color: statusInfo.color, fontSize: 10 }}>
                    {statusInfo.text}
                  </Caption>
                </View>
              )}

              <View className="flex-1 flex-row items-center mx-3">
                <Ionicons name="location" size={12} color="#6B7280" />
                <Caption numberOfLines={1} style={{ color: '#6B7280', fontSize: 11, marginLeft: 4 }}>
                  {item.location}
                </Caption>
              </View>

              <Caption style={{ color: '#9CA3AF', fontSize: 11 }}>
                #{formatShortId(item.id)}
              </Caption>
            </View>
          </View>
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

      {/* Report Detail Modal */}
      <Modal visible={showDetail} animationType="slide" onRequestClose={() => { setShowDetail(false); setSelectedReport(null); }}>
        <View className={`flex-1 bg-white`} style={{ paddingTop: 5 }}>
          <View className={`px-4 py-3 border-b border-gray-200 bg-white`}>
            <View className="flex-row items-center justify-between">
              <TouchableOpacity onPress={() => { setShowDetail(false); setSelectedReport(null); }} className="p-2">
                <Ionicons name="close" size={26} color="#1F2937" />
              </TouchableOpacity>
              <ScaledText baseSize={18} className={`font-semibold text-gray-900`}>Report Details</ScaledText>
              <View className="w-8" />
            </View>
          </View>

          {selectedReport && (
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
              <View className="flex-row items-center mb-6">
                <View
                  className={`w-16 h-16 rounded-full items-center justify-center mr-4 shadow-sm`}
                  style={{ backgroundColor: getIncidentColor(selectedReport.incident_type) + '1A' }}
                >
                  <Ionicons
                    name={getIncidentIcon(selectedReport.incident_type) as any}
                    size={32}
                    color={getIncidentColor(selectedReport.incident_type)}
                  />
                </View>
                <View className="flex-1">
                  <ScaledText baseSize={22} className={`font-bold mb-2 text-gray-900`}>{selectedReport.incident_type}</ScaledText>
                  <View className="flex-row items-center gap-x-2">
                    {(() => {
                      const statusKey = String(selectedReport.status) as keyof typeof statusMap;
                      const statusMap = {
                        'PENDING': { text: 'SENT', color: '#6B7280', backgroundColor: '#F3F4F6' },
                        'ACKNOWLEDGED': { text: 'RECEIVED', color: '#D97706', backgroundColor: '#FEF3C7' },
                        'ON_GOING': { text: 'RESPONDERS ON WAY', color: '#EA580C', backgroundColor: '#FFEDD5' },
                        'RESOLVED': { text: 'RESOLVED', color: '#16A34A', backgroundColor: '#DCFCE7' },
                        'DECLINED': { text: 'RECORDED', color: '#0EA5E9', backgroundColor: '#E0F2FE' },
                      };
                      const badgeInfo = statusMap[statusKey] || { text: (selectedReport.status || 'N/A').toUpperCase(), color: '#6B7280', backgroundColor: '#F3F4F6' };
                      return (
                        <View
                          className="px-3 py-1 rounded-full self-start"
                          style={{ backgroundColor: badgeInfo.backgroundColor }}
                        >
                          <ScaledText baseSize={12} className="font-semibold" style={{ color: badgeInfo.color }}>
                            {badgeInfo.text}
                          </ScaledText>
                        </View>
                      );
                    })()}
                    {(() => {
                      const statusInfo = getPatientStatusInfo(selectedReport.patient_status || 'No Patient');
                      return (
                        <View
                          className="px-3 py-1 rounded-full self-start flex-row items-center"
                          style={{ backgroundColor: statusInfo.color + '1A' }}
                        >
                          <Ionicons name={statusInfo.icon as any} size={12} color={statusInfo.color} style={{ marginRight: 5 }} />
                          <ScaledText baseSize={12} className="font-semibold" style={{ color: statusInfo.color }}>
                            {statusInfo.text}
                          </ScaledText>
                        </View>
                      );
                    })()}
                  </View>
                </View>
              </View>

              <View className="mb-6">
                <ScaledText baseSize={18} className={`font-semibold mb-2 text-gray-900`}>Location</ScaledText>
                <View className={`flex-row items-center p-4 rounded-xl bg-gray-50`}>
                  <Ionicons name="location" size={20} color="#4A90E2" />
                  <ScaledText baseSize={16} className={`ml-2 text-gray-700`}>{selectedReport.location}</ScaledText>
                </View>
              </View>

              <View className="mb-6">
                <ScaledText baseSize={18} className={`font-semibold mb-2 text-gray-900`}>Description</ScaledText>
                <View className={`p-4 rounded-xl bg-gray-50`}>
                  <ScaledText baseSize={16} className={`leading-6 text-gray-700`}>{selectedReport.description}</ScaledText>
                </View>
              </View>

              {selectedReport.uploaded_media && selectedReport.uploaded_media.length > 0 && (
                <View className="mb-6">
                  <ScaledText baseSize={18} className={`font-semibold mb-2 text-gray-900`}>Attached Media</ScaledText>
                  <View className="flex-row flex-wrap gap-2">
                    {selectedReport.uploaded_media.map((mediaUrl: string, index: number) => (
                      <TouchableOpacity key={index} className={`w-20 h-20 rounded-lg overflow-hidden bg-gray-100`} onPress={() => { setSelectedImageIndex(index); setShowImageViewer(true); }} activeOpacity={0.8}>
                        <Image source={{ uri: mediaUrl }} className="w-full h-full" resizeMode="cover" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View className="mb-6">
                <ScaledText baseSize={18} className={`font-semibold mb-2 text-gray-900`}>Report Information</ScaledText>
                <View className={`p-4 rounded-xl space-y-3 bg-gray-50`}>
                  <View className="flex-row justify-between">
                    <ScaledText baseSize={14} className={'text-gray-600'}>Report ID:</ScaledText>
                    <ScaledText baseSize={16} className={`font-medium text-gray-900`}>#{formatShortId(selectedReport.id)}</ScaledText>
                  </View>
                  <View className="flex-row justify-between">
                    <ScaledText baseSize={14} className={'text-gray-600'}>Submitted:</ScaledText>
                    <ScaledText baseSize={16} className={`font-medium text-gray-900`}>
                      {new Date(selectedReport.incident_datetime).toLocaleDateString()} at {new Date(selectedReport.incident_datetime).toLocaleTimeString()}
                    </ScaledText>
                  </View>
                  <View className="flex-row justify-between">
                    <ScaledText baseSize={14} className={'text-gray-600'}>Patient Status (AVPU):</ScaledText>
                    <ScaledText baseSize={16} className={`font-medium text-gray-900`}>
                      {getPatientStatusInfo(selectedReport.patient_status || 'No Patient').text}
                    </ScaledText>
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


