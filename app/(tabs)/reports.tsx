import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React from 'react'
import { ActivityIndicator, DeviceEventEmitter, Dimensions, FlatList, Image, Linking, Modal, RefreshControl, SafeAreaView, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppModal from '../../components/AppModal'
import OfflineModeBanner from '../../components/OfflineModeBanner'
import ScaledText from '../../components/ScaledText'
import SyncStatusIndicator from '../../components/SyncStatusIndicator'
import { Body, Caption, Subtitle, Title } from '../../components/Typography'
import { images } from '../../constants/images'
import { api } from '../../src/api/client'
import { useSettings } from '../../src/context/SettingsContext'
import { useSync } from '../../src/context/SyncContext'
import { useUser } from '../../src/context/UserContext'
import { Report, supabase } from '../../src/lib/supabase'

const Reports = () => {
  const { textScale } = useSettings()
  const { width } = useWindowDimensions()
  const spacingScale = Math.min(textScale, 1.2) * (width < 360 ? 0.95 : width > 720 ? 1.1 : 1)
  const s = (px: number) => Math.round(px * spacingScale)
  const params = useLocalSearchParams();
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useUser()
  const { isOnline, manualSync, retryFailedReports, isSyncing } = useSync()
  const [showDetail, setShowDetail] = React.useState(false)
  const [selectedReport, setSelectedReport] = React.useState<any>(null)
  const [showImageViewer, setShowImageViewer] = React.useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0)
  const [imageViewerImages, setImageViewerImages] = React.useState<string[]>([])
  const [reports, setReports] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)

  const [modalVisible, setModalVisible] = React.useState(false)
  const [modalTitle, setModalTitle] = React.useState('')
  const [modalMessage, setModalMessage] = React.useState('')
  const [modalIcon, setModalIcon] = React.useState<'checkmark-circle' | 'warning' | 'information-circle'>('information-circle')
  const [modalIconColor, setModalIconColor] = React.useState('#2563EB')
  const [showCallConfirm, setShowCallConfirm] = React.useState(false)

  const showModal = (title: string, message: string, icon: 'checkmark-circle' | 'warning' | 'information-circle', color: string) => {
    setModalTitle(title)
    setModalMessage(message)
    setModalIcon(icon)
    setModalIconColor(color)
    setModalVisible(true)
  }

  // Incident type icons mapping
  const getIncidentIcon = (type: string) => {
    const iconMap: { [key: string]: string } = {
      'Fire': 'flame',
      'Vehicular Accident': 'car',
      'Flood': 'water',
      'Earthquake': 'earth',
      'Electrical': 'flash'
    }
    return iconMap[type] || 'warning'
  }

  // Incident icon colors mapping (for better visual semantics)
  const getIncidentColor = (type: string) => {
    const colorMap: { [key: string]: string } = {
      'Fire': '#FF6B35',
      'Vehicular Accident': '#FF4444',
      'Flood': '#4A90E2',
      'Earthquake': '#8B4513',
      'Electrical': '#F59E0B'
    }
    return colorMap[type] || '#3B82F6'
  }

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

  // Format a compact, user-friendly ID from UUID/number
  const formatShortId = (id: any) => {
    if (id == null) return ''
    const s = String(id)
    // If UUID, strip dashes and take first 6 chars
    if (s.includes('-')) return s.replace(/-/g, '').slice(0, 4).toUpperCase()
    // If already short, return uppercased slice
    return s.slice(0, 4).toUpperCase()
  }

  // Get status badge display info
  const getStatusBadgeInfo = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { text: 'SENT', color: '#6B7280', backgroundColor: '#F3F4F6' };
      case 'ACKNOWLEDGED':
        return { text: 'RECEIVED', color: '#D97706', backgroundColor: '#FEF3C7' };
      case 'ON_GOING':
        return { text: 'RESPONDERS ON WAY', color: '#EA580C', backgroundColor: '#FFEDD5' };
      case 'RESOLVED':
        return { text: 'RESOLVED', color: '#16A34A', backgroundColor: '#DCFCE7' };
      case 'DECLINED':
        return { text: 'DECLINED', color: '#DC2626', backgroundColor: '#FEE2E2' };
      default:
        return { text: (status || 'N/A').toUpperCase(), color: '#6B7280', backgroundColor: '#F3F4F6' };
    }
  };

  // Fetch reports from API and offline storage
  const fetchReports = React.useCallback(async () => {
    try {
      if (!user?.id) { setReports([]); return }
      setIsLoading(true)
      
      let onlineReports: any[] = []
      
      // Fetch online reports if connected
      if (isOnline) {
        try {
          onlineReports = await api.reports.getAll(user.id)
        } catch (error) {
          console.warn('Failed to fetch online reports:', error)
        }
      }
      
      // Note: We don't include offline reports in the main reports list anymore
      // because synced offline reports should already be on the server and fetched as online reports
      // This prevents duplicates
      
      // Use only online reports (which includes previously synced offline reports)
      const allReports = onlineReports
        .sort((a, b) => new Date(b.incident_datetime).getTime() - new Date(a.incident_datetime).getTime())
      
      setReports(allReports)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch reports'
      showModal('Connection error', `${msg}\n\nPlease check your internet connection and Supabase credentials.`, 'warning', '#EF4444')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, isOnline])

  // Refresh reports and sync pending items
  const onRefresh = async () => {
    setRefreshing(true)
    try {
      // Trigger sync if online and not already syncing
      if (isOnline && !isSyncing) {
        await manualSync()
      }
      // Fetch latest reports
      await fetchReports()
    } catch (error) {
      console.error('Refresh error:', error)
    } finally {
      setRefreshing(false)
    }
  }

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        fetchReports()
      }
    }, [fetchReports, user?.id])
  )

  // Real-time updates via Supabase Realtime
  React.useEffect(() => {
    if (!user?.id || !isOnline) return;

    const channel = supabase
      .channel('reports-changes')
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'reports',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: { new: Report, old: Report, eventType: string }) => {
          setReports(currentReports => {
            if (payload.eventType === 'INSERT') {
              return [payload.new, ...currentReports];
            }
            if (payload.eventType === 'UPDATE') {
              return currentReports.map(report => 
                report.id === payload.new.id ? payload.new : report
              );
            }
            if (payload.eventType === 'DELETE') {
              return currentReports.filter(report => report.id !== payload.old.id);
            }
            return currentReports;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isOnline]);

  // Open Add modal when navigated with ?openAdd=1
  React.useEffect(() => {
    if (params?.openAdd && String(params.openAdd) !== '0') {
      router.push('/(tabs)/create-report')
    }
  }, [params?.openAdd, router])

  // Listen for add button press from tab bar
  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('OPEN_REPORTS_ADD', () => {
      router.push('/(tabs)/create-report')
    })
    return () => subscription.remove()
  }, [router])

  // Handle report selection
  const handleReportPress = (report: any) => {
    setSelectedReport(report)
    setShowDetail(true)
  }

  // Handle detail modal close
  const handleDetailClose = () => {
    setShowDetail(false)
    setSelectedReport(null)
  }

  // Handle image viewer open
  const handleImagePress = (images: string[], index: number) => {
    setImageViewerImages(images)
    setSelectedImageIndex(index)
    setShowImageViewer(true)
  }

  // Handle image viewer close
  const handleImageViewerClose = () => {
    setShowImageViewer(false)
    setImageViewerImages([])
    setSelectedImageIndex(0)
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  // Get sync status color and icon
  const getSyncStatusInfo = (item: any) => {
    if (!item.isOffline) {
      return { color: '#10B981', icon: 'checkmark-circle', text: 'SYNCED' }
    }
    
    switch (item.sync_status) {
      case 'pending':
        return { color: '#F59E0B', icon: 'time', text: 'PENDING' }
      case 'syncing':
        return { color: '#3B82F6', icon: 'sync', text: 'SYNCING' }
      case 'error':
        return { color: '#EF4444', icon: 'warning', text: 'ERROR' }
      case 'synced':
        return { color: '#10B981', icon: 'checkmark-circle', text: 'SYNCED' }
      default:
        return { color: '#F59E0B', icon: 'time', text: 'PENDING' }
    }
  }

  // Render report item
  const renderReportItem = ({ item }: { item: any }) => {
    const syncInfo = getSyncStatusInfo(item)
    const statusInfo = getPatientStatusInfo(item.patient_status || 'No Patient');
    const badgeInfo = getStatusBadgeInfo(item.status || 'PENDING');
    
    return (
      <TouchableOpacity
        onPress={() => handleReportPress(item)}
        activeOpacity={0.85}
        className="mx-4"
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
            {/* Top row: icon, title, timestamp */}
            <View className="flex-row items-start justify-between">
              <View className="flex-row items-center flex-1">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{
                    backgroundColor: getIncidentColor(item.incident_type) + '1A',
                  }}
                >
                  <Ionicons
                    name={getIncidentIcon(item.incident_type) as any}
                    size={20}
                    color={getIncidentColor(item.incident_type)}
                  />
                </View>
                <View className="flex-1">
                  <Subtitle
                    className="text-lg font-bold"
                    style={{ color: '#111827' }}
                    numberOfLines={1}
                  >
                    {item.incident_type}
                  </Subtitle>
                  {item.isOffline && (
                    <View className="mt-1 self-start px-2 py-0.5 rounded-full bg-gray-100">
                      <Caption
                        className="font-medium"
                        style={{ color: '#6B7280', fontSize: 10 }}
                      >
                        OFFLINE
                      </Caption>
                    </View>
                  )}
                </View>
              </View>
              <Caption
                className="text-xs"
                style={{ color: '#9CA3AF', marginLeft: 8 }}
              >
                {formatTimestamp(item.incident_datetime)}
              </Caption>
            </View>

            {/* Middle row: description */}
            {item.description ? (
              <Body
                className="mt-2 text-sm"
                style={{ color: '#4B5563' }}
                numberOfLines={2}
              >
                {item.description}
              </Body>
            ) : null}

            {/* Bottom row: status badge, location, sync */}
            <View className="mt-3 flex-row items-center justify-between">
              <View
                className="px-2.5 py-1 rounded-full"
                style={{ backgroundColor: badgeInfo.backgroundColor }}
              >
                <Caption
                  className="font-semibold"
                  style={{ color: badgeInfo.color, fontSize: 10 }}
                >
                  {badgeInfo.text}
                </Caption>
              </View>
              {statusInfo && (
                <View
                  className="flex-row items-center px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: statusInfo.color + '1A',
                  }}
                >
                  <Ionicons
                    name={statusInfo.icon as any}
                    size={11}
                    color={statusInfo.color}
                    style={{ marginRight: 4 }}
                  />
                  <Caption
                    className="font-semibold"
                    style={{ color: statusInfo.color, fontSize: 10 }}
                  >
                    {statusInfo.text}
                  </Caption>
                </View>
              )}

              <View className="flex-1 flex-row items-center mx-3">
                <Ionicons name="location" size={12} color="#6B7280" />
                <Caption
                  numberOfLines={1}
                  style={{
                    color: '#6B7280',
                    fontSize: 11,
                    marginLeft: 4,
                  }}
                >
                  {item.location}
                </Caption>
              </View>

              <View className="flex-row items-center">
                {item.sync_status === 'syncing' && (
                  <ActivityIndicator
                    size="small"
                    color={syncInfo.color}
                    style={{ marginRight: 6 }}
                  />
                )}
                <Ionicons
                  name={syncInfo.icon as any}
                  size={14}
                  color={syncInfo.color}
                />
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView className={`flex-1 bg-gray-50`}>
      <View className={`flex-1 bg-gray-50 pt-4`} style={{ paddingBottom: insets.bottom }}>
        {/* Header */}
          <View className={`bg-white px-6 py-6 border-b border-gray-100 shadow-sm`} style={{ paddingHorizontal: s(32), paddingVertical: s(32) }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 self-center p-2 mt-4 flex-row items-center">
              <Image source={images.logo} style={{ width: Math.round(70 * Math.min(textScale, 1.25)), height: Math.round(70 * Math.min(textScale, 1.25)), resizeMode: 'contain', marginRight: s(20) }} />
              <View>
                <Title style={{ marginBottom: s(4) }}>Reports</Title>
                <Subtitle style={{ color: '#4B5563' }}>
                  {reports.length} {reports.length === 1 ? 'report' : 'reports'}
                </Subtitle>
              </View>
            </View>
            <SyncStatusIndicator 
              compact={true}
              onPress={() => {
                if (!isOnline) {
                  showModal('Offline Mode', 'You are currently offline. Reports will sync when connection is restored.', 'information-circle', '#F59E0B')
                } else {
                  manualSync().then(result => {
                    if (result.success) {
                      showModal('Sync Complete', `Successfully synced ${result.syncedCount} reports.`, 'checkmark-circle', '#10B981')
                    } else {
                      showModal('Sync Failed', `Failed to sync ${result.errorCount} reports.`, 'warning', '#EF4444')
                    }
                  }).catch(error => {
                    showModal('Sync Error', error.message, 'warning', '#EF4444')
                  })
                }
              }}
            />
          </View>
        </View>

        {/* Offline Mode Banner */}
        <OfflineModeBanner 
          onRetryPress={() => {
            retryFailedReports().then(result => {
              if (result.success) {
                showModal('Retry Complete', `Successfully synced ${result.syncedCount} reports.`, 'checkmark-circle', '#10B981')
              } else {
                showModal('Retry Failed', `Failed to sync ${result.errorCount} reports.`, 'warning', '#EF4444')
              }
            }).catch(error => {
              showModal('Retry Error', error.message, 'warning', '#EF4444')
            })
          }}
          onManualSyncPress={() => {
            manualSync().then(result => {
              if (result.success) {
                showModal('Sync Complete', `Successfully synced ${result.syncedCount} reports.`, 'checkmark-circle', '#10B981')
              } else {
                showModal('Sync Failed', `Failed to sync ${result.errorCount} reports.`, 'warning', '#EF4444')
              }
            }).catch(error => {
              showModal('Sync Error', error.message, 'warning', '#EF4444')
            })
          }}
        />

        {/* Reports List */}
        {isLoading ? (
          <View className={`flex-1 items-center justify-center bg-gray-50`}>
            <Text className={`text-lg text-gray-500`}>Loading your reports...</Text>
          </View>
        ) : reports.length === 0 ? (
          <ScrollView
            className={`flex-1 bg-gray-50`}
            contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(32) }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#4A90E2"]}
                tintColor={'#4A90E2'}
                progressBackgroundColor={'#ffffff'}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            <View className={`bg-white rounded-3xl shadow-lg items-center mx-4`} style={{ padding: s(40) }}>
              <View className="w-20 h-20 bg-blue-50 rounded-full items-center justify-center mb-6">
                <Ionicons name="document-outline" size={40} color="#4A90E2" />
              </View>
              <ScaledText baseSize={20} className={`font-bold mb-3 text-center text-gray-900`}>
                {reports.length === 0 ? 'No Reports Yet' : 'No Reports'}
              </ScaledText>
              <ScaledText baseSize={16} className={`text-center leading-6 px-2 text-gray-500`}>
                {reports.length === 0 
                  ? 'Tap the + button below to create your first emergency report'
                  : 'Create a new report'}
              </ScaledText>
            </View>
          </ScrollView>
        ) : (
          <View className={`flex-1 bg-gray-50`}>
            <FlatList
              data={reports}
              renderItem={renderReportItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingTop: s(24), paddingBottom: insets.bottom + s(120), paddingHorizontal: 0 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={['#4A90E2']}
                  tintColor={'#4A90E2'}
                  progressBackgroundColor={'#ffffff'}
                />
              }
              showsVerticalScrollIndicator={false}
              className="flex-1"
              ItemSeparatorComponent={() => <View style={{ height: s(12) }} />}
            />
          </View>
        )}
      </View>

      {/* Floating call button */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setShowCallConfirm(true)}
        className="absolute right-5 z-50 w-14 h-14 rounded-full bg-red-500 items-center justify-center shadow-lg"
        style={{ bottom: insets.bottom + 90 }}
      >
        <Ionicons name="call" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Call Confirmation Modal */}
      <Modal visible={showCallConfirm} transparent={true} animationType="fade" onRequestClose={() => setShowCallConfirm(false)}>
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 mx-6 max-w-sm w-full">
            <View className="items-center">
              <View className="w-16 h-16 rounded-full items-center justify-center mb-4" style={{ backgroundColor: '#EF444420' }}>
                <Ionicons name="call" size={32} color="#EF4444" />
              </View>
              <ScaledText baseSize={20} className="font-bold text-gray-900 mb-2 text-center">Call Silang DRRMO?</ScaledText>
              <ScaledText baseSize={14} className="text-gray-600 text-center mb-6 leading-6">
                This will call Silang Disaster Risk Reduction and Management Office emergency hotline.
              </ScaledText>
              <View className="flex-row gap-3 w-full">
                <TouchableOpacity
                  onPress={() => setShowCallConfirm(false)}
                  className="flex-1 py-3 rounded-xl items-center bg-gray-200"
                >
                  <ScaledText baseSize={16} className="text-gray-800 font-semibold">Cancel</ScaledText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowCallConfirm(false)
                    Linking.openURL('tel:09356016738')
                  }}
                  className="flex-1 py-3 rounded-xl items-center"
                  style={{ backgroundColor: '#EF4444' }}
                >
                  <ScaledText baseSize={16} className="text-white font-semibold">Call Now</ScaledText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Detail Modal */}
      <Modal visible={showDetail} animationType="slide" onRequestClose={handleDetailClose}>
        <View className={`flex-1 bg-white`}>
          <View className={`px-4 py-4 border-b shadow-sm bg-white border-gray-100`}>
            <View className="flex-row items-center justify-between">
              <TouchableOpacity onPress={handleDetailClose} className="p-2">
                <Ionicons name="close" size={24} color="#666" />
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
                  <ScaledText baseSize={22} className={`font-bold mb-1 text-gray-900`}>{selectedReport.incident_type}</ScaledText>
                  {(() => {
                    const statusInfo = getPatientStatusInfo(selectedReport.patient_status || 'No Patient');
                    return (
                      <View
                        className="px-3 py-1 rounded-full self-start flex-row items-center"
                        style={{ backgroundColor: statusInfo.color + '1A' }}
                      >
                        <Ionicons
                          name={statusInfo.icon as any}
                          size={14}
                          color={statusInfo.color}
                          style={{ marginRight: 6 }}
                        />
                        <ScaledText
                          baseSize={14}
                          className="font-semibold"
                          style={{ color: statusInfo.color }}
                        >
                          {statusInfo.text}
                        </ScaledText>
                      </View>
                    );
                  })()}
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
                      <TouchableOpacity key={index} className={`w-20 h-20 rounded-lg overflow-hidden bg-gray-100`} onPress={() => handleImagePress(selectedReport.uploaded_media, index)} activeOpacity={0.8}>
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
                  <View className="flex-row justify-between">
                    <ScaledText baseSize={14} className={'text-gray-600'}>Status:</ScaledText>
                    <ScaledText baseSize={16} className={`font-medium text-gray-900`}>REPORTED</ScaledText>
                  </View>
                </View>
              </View>

            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal visible={showImageViewer} animationType="fade" onRequestClose={handleImageViewerClose} transparent={true}>
        <View className="flex-1 bg-black">
          <View className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-50 pt-12 pb-4 px-4">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity onPress={handleImageViewerClose} className="p-2">
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text className="text-white text-lg font-semibold">{selectedImageIndex + 1} of {imageViewerImages.length}</Text>
              <View className="w-8" />
            </View>
          </View>
          <View className="flex-1 items-center justify-center">
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: selectedImageIndex * Dimensions.get('window').width, y: 0 }} onMomentumScrollEnd={(event) => { const index = Math.round(event.nativeEvent.contentOffset.x / Dimensions.get('window').width); setSelectedImageIndex(index) }}>
              {imageViewerImages.map((imageUrl, index) => (
                <View key={index} className="w-full h-full" style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height }}>
                  <Image source={{ uri: imageUrl }} className="w-full h-full" style={{ resizeMode: 'contain' }} />
                </View>
              ))}
            </ScrollView>
          </View>
          {imageViewerImages.length > 1 && (
            <View className="absolute bottom-0 left-0 right-0 z-10 bg-black bg-opacity-50 py-4">
              <View className="flex-row justify-center space-x-2">
                {imageViewerImages.map((_, index) => (
                  <View key={index} className={`w-2 h-2 rounded-full ${ index === selectedImageIndex ? 'bg-white' : 'bg-white bg-opacity-50' }`} />
                ))}
              </View>
            </View>
          )}
        </View>
      </Modal>


      <AppModal visible={modalVisible} onClose={() => setModalVisible(false)} icon={modalIcon} iconColor={modalIconColor} title={modalTitle} message={modalMessage} actions={[{ label: 'OK', onPress: () => setModalVisible(false), variant: 'primary' }]} />
    </SafeAreaView>
  )
}

export default Reports