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

  // Real-time updates via Supabase Realtime for admin
  useEffect(() => {
    // Dynamic import to avoid circular dependencies
    import('../../src/lib/supabase').then(({ supabase }) => {
    
      // Subscribe to INSERT events on reports table (all reports for admin)
      const channel = supabase
        .channel('admin-reports-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT', // Listen to new reports
            schema: 'public',
            table: 'reports',
          },
          (payload: any) => {
            // Refresh dashboard when new report is inserted
            load()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    })
  }, [load])

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

  const renderRecent = ({ item }: { item: any }) => {
    // Only show status tag for Vehicular Accident and Others incident types
    const shouldShowStatus = item.incident_type === 'Vehicular Accident' || item.incident_type === 'Others';
    const statusInfo = shouldShowStatus ? getPatientStatusInfo(item.patient_status || item.urgency_tag || 'Low') : null;
    
    return (
    <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-3" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center mr-3">
            <Ionicons name="document-text" size={18} color="#4A90E2" />
          </View>
          <View className="flex-1">
            <ScaledText baseSize={14} className="font-semibold text-gray-900">{item.incident_type}</ScaledText>
            <Text className="text-xs text-gray-500">{new Date(item.incident_datetime || item.created_at).toLocaleString()}</Text>
          </View>
        </View>
        {statusInfo && (
          <View className="px-2 py-1 rounded-full flex-row items-center" style={{ backgroundColor: statusInfo.color + 'E6' }}>
            <Ionicons name={statusInfo.icon as any} size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
            <Text className="text-[10px] font-bold" style={{ color: '#FFFFFF' }}>
              {statusInfo.text}
            </Text>
          </View>
        )}
      </View>
      {item.description ? <Text className="text-gray-600 text-sm mt-2" numberOfLines={2}>{item.description}</Text> : null}
    </View>
    );
  };

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
          <View className="bg-white px-6 py-6 border border-gray-100 rounded-2xl mb-4 shadow-sm">
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
            <View className="bg-white rounded-2xl border border-gray-100 p-4 flex-row items-center shadow-sm">
              <View className="w-12 h-12 rounded-full bg-blue-50 items-center justify-center mr-4">
                <Ionicons name="shield-checkmark" size={22} color="#2563EB" />
              </View>
              <View className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 mr-4">
                {user?.profile_pic ? (
                  <Image source={{ uri: user.profile_pic }} className="w-full h-full" resizeMode="cover" />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Ionicons name="person" size={20} color="#4A90E2" />
                  </View>
                )}
              </View>
              <View className="flex-1">
                <ScaledText baseSize={18} className="font-bold text-gray-900">{user?.name || 'Admin'}</ScaledText>
                <Text style={{ color: '#4B5563', marginTop: 2 }} numberOfLines={1}>Barangay: <Text className="font-medium">{user?.barangay || '—'}</Text></Text>
                <Text style={{ color: '#4B5563' }} numberOfLines={1}>Position: <Text className="font-medium">{user?.barangay_position || '—'}</Text></Text>
              </View>
            </View>
          </View>

          {stats && (
            <View>
              {/* Overview stats */}
              <View className="flex-row mb-4">
                <View className="flex-1 bg-white rounded-xl border border-gray-100 mr-2 px-4 py-3 shadow-sm">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <View className="w-9 h-9 rounded-full bg-blue-50 items-center justify-center mr-3">
                        <Ionicons name="bar-chart" size={18} color="#2563EB" />
                      </View>
                      <ScaledText baseSize={12} className="text-gray-600">Total Reports</ScaledText>
                    </View>
                    <ScaledText baseSize={22} className="font-bold text-gray-900">{stats.totalReports}</ScaledText>
                  </View>
                </View>
                <View className="flex-1 bg-white rounded-xl border border-gray-100 ml-2 px-4 py-3 shadow-sm">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <View className="w-9 h-9 rounded-full bg-emerald-50 items-center justify-center mr-3">
                        <Ionicons name="people" size={18} color="#059669" />
                      </View>
                      <ScaledText baseSize={12} className="text-gray-600">Total Users</ScaledText>
                    </View>
                    <ScaledText baseSize={22} className="font-bold text-gray-900">{stats.totalUsers}</ScaledText>
                  </View>
                </View>
              </View>

              {/* Reports by Incident Type */}
              <View style={{ marginTop: s(4), marginBottom: s(8) }}>
                <ScaledText baseSize={13} className="font-semibold text-gray-800 mb-2">Reports by Incident Type</ScaledText>
                <View className="flex-row flex-wrap -mx-1">
                  {incidentEntries.map(([type, count]: [string, number]) => (
                    <View key={type} className="w-1/2 px-1 mb-2">
                      <View className="bg-white rounded-xl border border-gray-100 px-3 py-3 shadow-sm flex-row items-center justify-between">
                        <View className="flex-row items-center flex-1 pr-2">
                          <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center mr-2">
                            <Ionicons name="information-circle" size={18} color="#2563EB" />
                          </View>
                          <ScaledText baseSize={12} className="text-gray-800" numberOfLines={1}>{type}</ScaledText>
                        </View>
                        <ScaledText baseSize={18} className="font-bold text-gray-900">{count}</ScaledText>
                      </View>
                    </View>
                  ))}
                  {incidentEntries.length === 0 && !loading ? (
                    <ScaledText baseSize={13} className="text-gray-500">No reports yet.</ScaledText>
                  ) : null}
                </View>
              </View>

              {/* Users by Barangay */}
              <ScaledText baseSize={14} className="font-semibold text-gray-900 mb-2">Users by Barangay</ScaledText>
              <View className="bg-white rounded-xl border border-gray-100 mb-4 shadow-sm">
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
                <View className="bg-white rounded-2xl border border-gray-100 items-center shadow-sm" style={{ padding: s(24) }}>
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


