import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, Modal, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScaledText from '../../components/ScaledText';
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

  const getUrgencyColor = (urgency: string) => {
    const colorMap: { [key: string]: string } = {
      'Low': '#10B981',
      'Moderate': '#F59E0B',
      'High': '#EF4444'
    };
    return colorMap[urgency] || '#6B7280';
  };

  const formatShortId = (id: any) => {
    if (id == null) return '';
    const s = String(id);
    if (s.includes('-')) return s.replace(/-/g, '').slice(0, 4).toUpperCase();
    return s.slice(0, 4).toUpperCase();
  };
  const renderReportItem = ({ item }: { item: any }) => (
    <TouchableOpacity activeOpacity={0.9} className="bg-white rounded-2xl border border-gray-100 p-4 mb-3" onPress={() => { setSelectedReport(item); setShowDetail(true); }} style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 }}>
      <View className="flex-row">
        <View className="w-12 h-12 rounded-xl bg-white items-center justify-center mr-4 shadow-sm">
          <Ionicons name={getIncidentIcon(item.incident_type)} size={24} color={getIncidentColor(item.incident_type)} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-gray-900" numberOfLines={1}>{item.incident_type}</Text>
            <View className="px-2 py-1 rounded-full" style={{ backgroundColor: getUrgencyColor(item.urgency_tag) + 'E6' }}>
              <Text className="text-[10px] font-bold" style={{ color: '#FFFFFF' }}>{String(item.urgency_tag || '').toUpperCase()}</Text>
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
                  <View className="px-3 py-1 rounded-full self-start" style={{ backgroundColor: getUrgencyColor(selectedReport.urgency_tag) + 'E6' }}>
                    <Text className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{String(selectedReport.urgency_tag).toUpperCase()} PRIORITY</Text>
                  </View>
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


