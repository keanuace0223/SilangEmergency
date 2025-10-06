import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ScaledText from '../../components/ScaledText';
import { images } from '../../constants/images';
import { useSettings } from '../../src/context/SettingsContext';
import { useUser } from '../../src/context/UserContext';
import { adminApi, type AdminStats } from '../../src/utils/adminApi';

export default function AdminOverviewScreen() {
  const insets = useSafeAreaInsets();
  const { textScale } = useSettings();
  const { user } = useUser();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);
  const [allReports, setAllReports] = useState<any[]>([]);

  const s = useMemo(() => (px: number) => Math.round(px * Math.min(textScale, 1.2)), [textScale]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const sData = await adminApi.getStats();
      setStats(sData);
      const { reports } = await adminApi.getReports({ page: 1, limit: 5 });
      setRecent(reports || []);
      const all = await adminApi.getReports({ page: 1, limit: 200 });
      setAllReports(all.reports || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const countsByIncident = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of allReports) {
      const key = r.incident_type || 'Unknown';
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [allReports]);

  const countsByUrgency = useMemo(() => {
    const map: Record<string, number> = { Low: 0, Moderate: 0, High: 0 } as any;
    for (const r of allReports) {
      const key = r.urgency_tag || 'Unknown';
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [allReports]);

  const incidentEntries = useMemo(() => Object.entries(countsByIncident), [countsByIncident]);
  const urgencyEntries = useMemo(() => Object.entries(countsByUrgency), [countsByUrgency]);

  const renderRecent = ({ item }: { item: any }) => (
    <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-3" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center mr-3">
            <Ionicons name="document-text" size={18} color="#4A90E2" />
          </View>
          <View>
            <ScaledText baseSize={14} className="font-semibold text-gray-900">{item.incident_type}</ScaledText>
            <Text className="text-xs text-gray-500">{new Date(item.incident_datetime || item.created_at).toLocaleString()}</Text>
          </View>
        </View>
        <View className="px-2 py-1 rounded-full" style={{ backgroundColor: '#E8F1FD' }}>
          <Text className="text-[10px] font-bold" style={{ color: '#4A90E2' }}>{String(item.urgency_tag || '').toUpperCase() || '—'}</Text>
        </View>
      </View>
      {item.description ? <Text className="text-gray-600 text-sm mt-2" numberOfLines={2}>{item.description}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top','bottom']}>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <ScaledText baseSize={14} className="text-gray-600 mt-2">Loading overview...</ScaledText>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 140 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {/* Header mirror (inside scroll, not sticky) */}
          <View className="bg-white px-6 py-6 border border-gray-100 rounded-2xl mb-4">
            <View className="flex-row items-center">
              <Image source={images.logo} style={{ width: Math.round(70 * Math.min(textScale, 1.25)), height: Math.round(70 * Math.min(textScale, 1.25)), resizeMode: 'contain', marginRight: s(20) }} />
              <View>
                <ScaledText baseSize={22} className="font-bold text-gray-900">Admin Overview</ScaledText>
                <Text className="text-gray-600">System-wide statistics & recent reports</Text>
              </View>
            </View>
          </View>

          {/* Admin info card (mirror of user card) */}
          <View className="px-1 pb-2">
            <View className="bg-[#3B82F6] rounded-2xl border border-gray-100 p-4 flex-row items-center">
              <View className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 mr-6">
                {user?.profile_pic ? (
                  <Image source={{ uri: user.profile_pic }} className="w-full h-full" resizeMode="cover" />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Ionicons name="person" size={20} color="#4A90E2" />
                  </View>
                )}
              </View>
              <View className="flex-1">
                <ScaledText baseSize={18} className="font-bold" style={{ color: '#fff' }}>{user?.name || 'Admin'}</ScaledText>
                <Text style={{ color: '#E5E7EB', marginTop: 2 }} numberOfLines={1}>Barangay: <Text className="font-medium">{user?.barangay || '—'}</Text></Text>
                <Text style={{ color: '#E5E7EB' }} numberOfLines={1}>Position: <Text className="font-medium">{user?.barangay_position || '—'}</Text></Text>
              </View>
            </View>
          </View>

          {stats && (
            <View>
              {/* Overview stats (mirroring style) */}
              <View className="flex-row justify-between mb-3">
                <View className="flex-1 rounded-xl" style={{ backgroundColor: '#3B82F6', padding: s(12), marginRight: s(8) }}>
                  <ScaledText baseSize={12} style={{ color: '#FFFFFF' }}>Total Reports</ScaledText>
                  <ScaledText baseSize={22} className="font-bold mt-1" style={{ color: '#FFFFFF' }}>{stats.totalReports}</ScaledText>
                </View>
                <View className="flex-1 rounded-xl" style={{ backgroundColor: '#10B981', padding: s(12), marginLeft: s(8) }}>
                  <ScaledText baseSize={12} style={{ color: '#FFFFFF' }}>Total Users</ScaledText>
                  <ScaledText baseSize={22} className="font-bold mt-1" style={{ color: '#FFFFFF' }}>{stats.totalUsers}</ScaledText>
                </View>
              </View>

              {/* Reports by Incident Type (mirror tabs/index) */}
              <View style={{ marginTop: s(8), marginBottom: s(8) }}>
                <ScaledText baseSize={13} className="font-semibold text-gray-800 mb-2">Reports by Incident Type</ScaledText>
                <View className="flex-row flex-wrap -mx-1">
                  {incidentEntries.map(([type, count]: [string, number]) => (
                    <View key={type} className="w-1/2 px-1 mb-2">
                      <View className="rounded-xl" style={{ backgroundColor: '#3B82F6E6', padding: s(12) }}>
                        <Ionicons name="information-circle" size={18} color="#FFFFFF" />
                        <ScaledText baseSize={12} className="mt-1" style={{ color: '#FFFFFF' }} numberOfLines={1}>{type}</ScaledText>
                        <ScaledText baseSize={20} className="font-bold mt-1" style={{ color: '#FFFFFF' }}>{count}</ScaledText>
                      </View>
                    </View>
                  ))}
                  {incidentEntries.length === 0 && !loading ? (
                    <ScaledText baseSize={13} className="text-gray-500">No reports yet.</ScaledText>
                  ) : null}
                </View>
              </View>

              {/* Reports by Urgency (mirror tabs/index) */}
              <View style={{ marginTop: s(8), marginBottom: s(8) }}>
                <ScaledText baseSize={13} className="font-semibold text-gray-800 mb-2">Reports by Urgency</ScaledText>
                <View className="flex-row flex-wrap -mx-1">
                  {urgencyEntries.map(([level, count]: [string, number]) => (
                    <View key={level} className="w-1/3 px-1 mb-2">
                      <View className="rounded-xl items-center" style={{ backgroundColor: (level === 'High' ? '#EF4444' : level === 'Moderate' ? '#F59E0B' : '#10B981') + 'E6', padding: s(12) }}>
                        <ScaledText baseSize={12} style={{ color: '#FFFFFF' }} numberOfLines={1}>{level}</ScaledText>
                        <ScaledText baseSize={20} className="font-bold mt-1" style={{ color: '#FFFFFF' }}>{count}</ScaledText>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Users by Barangay */}
              <ScaledText baseSize={14} className="font-semibold text-gray-900 mb-2">Users by Barangay</ScaledText>
              <View className="bg-white rounded-xl border border-gray-100 mb-4">
                {stats.usersByBarangay.length === 0 ? (
                  <View className="items-center py-6">
                    <ScaledText baseSize={13} className="text-gray-500">No data</ScaledText>
                  </View>
                ) : (
                  stats.usersByBarangay.map((item) => (
                    <View key={item.barangay} className="flex-row justify-between px-4 py-3 border-b border-gray-100">
                      <ScaledText baseSize={13} className="text-gray-700">{item.barangay}</ScaledText>
                      <ScaledText baseSize={13} className="font-medium text-gray-900">{item.userCount}</ScaledText>
                    </View>
                  ))
                )}
              </View>

              {/* Recent Reports */}
              <ScaledText baseSize={16} className="font-semibold text-gray-900 mb-2">Recent Reports</ScaledText>
              {recent.length === 0 ? (
                <View className="bg-white rounded-2xl border border-gray-100 items-center" style={{ padding: s(24) }}>
                  <ScaledText baseSize={13} className="text-gray-500">No recent reports.</ScaledText>
                </View>
              ) : (
                <FlatList
                  data={recent}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={renderRecent}
                  scrollEnabled={false}
                />
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}


