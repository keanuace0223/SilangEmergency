import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import React from 'react'
import { ActivityIndicator, DeviceEventEmitter, Dimensions, FlatList, Image, Linking, Modal, RefreshControl, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import ScaledText from '../../components/ScaledText'
import { Body, Subtitle, Title } from '../../components/Typography'
import { images } from '../../constants/images'
import { api } from '../../src/api/client'
import { useSettings } from '../../src/context/SettingsContext'
import { useUser } from '../../src/context/UserContext'

const Home = () => {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { textScale } = useSettings()
  const spacingScale = Math.min(textScale, 1.2) * (width < 360 ? 0.95 : width > 720 ? 1.1 : 1)
  const s = (px: number) => Math.round(px * spacingScale)
 
  const router = useRouter()
  const { user } = useUser()
  // local detail modal state (mirror reports screen)
  const [showDetail, setShowDetail] = React.useState(false)
  const [selectedReport, setSelectedReport] = React.useState<any | null>(null)
  const [showImageViewer, setShowImageViewer] = React.useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0)
  const [imageViewerImages, setImageViewerImages] = React.useState<string[]>([])

  const [reports, setReports] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)

  const [coords, setCoords] = React.useState<{ latitude: number; longitude: number } | null>(null)
  const [isLocating, setIsLocating] = React.useState(false)

  // Modal state
  const [showCallConfirm, setShowCallConfirm] = React.useState(false)

  // Listen for add button press from tab bar (handle all tabs)
  React.useEffect(() => {
    const subscriptions = [
      DeviceEventEmitter.addListener('OPEN_HOME_ADD', () => router.push('/(tabs)/create-report')),
      DeviceEventEmitter.addListener('OPEN_DRAFTS_ADD', () => router.push('/(tabs)/create-report')),
      DeviceEventEmitter.addListener('OPEN_PROFILE_ADD', () => router.push('/(tabs)/create-report')),
    ]
    return () => subscriptions.forEach(sub => sub.remove())
  }, [router])

  const fetchReports = React.useCallback(async () => {
    try {
      if (!user?.id) {
        setReports([])
        return
      }
      setIsLoading(true)
      setError(null)
      const data = await api.reports.getAll(user.id)
      setReports(Array.isArray(data) ? data : [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load reports'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const getCurrentLocation = React.useCallback(async () => {
    try {
      setIsLocating(true)
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      
      // Try last known position first for instant feedback
      try {
        const lastKnown = await Location.getLastKnownPositionAsync()
        if (lastKnown) {
          setCoords({ latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude })
        }
      } catch {
        // ignore if no cached location
      }
      
      // Get current location with timeout
      const locationPromise = Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
      })
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 8000)
      )
      
      try {
        const location = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject
        setCoords({ latitude: location.coords.latitude, longitude: location.coords.longitude })
      } catch {
        // Keep cached position if timeout occurs
      }
    } catch {
      // ignore silently for dashboard
    } finally {
      setIsLocating(false)
    }
  }, [])


  React.useEffect(() => { if (user?.id) { fetchReports() } }, [fetchReports, user?.id])

  // When user object changes, no stale header values
  React.useEffect(() => {
    // no-op, triggers re-render; could also refetch stats here
  }, [user])
  React.useEffect(() => { getCurrentLocation() }, [getCurrentLocation])

  const withTimeout = React.useCallback(<T,>(promise: Promise<T>, ms: number): Promise<T | void> => {
    return Promise.race([
      promise,
      new Promise<void>((resolve) => setTimeout(resolve, ms))
    ]) as Promise<T | void>
  }, [])

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.allSettled([
        withTimeout(fetchReports(), 8000),
        withTimeout(getCurrentLocation(), 5000)
      ])
    } finally {
      setRefreshing(false)
    }
  }, [fetchReports, getCurrentLocation, withTimeout])

  const countsByIncident = React.useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of reports) {
      const key = r.incident_type || 'Unknown'
      map[key] = (map[key] || 0) + 1
    }
    return map
  }, [reports])

  const incidentEntries = React.useMemo(() => Object.entries(countsByIncident), [countsByIncident])

  // Match icon and color logic from reports screen
  const getIncidentIcon = (type: string): any => {
    const iconMap: { [key: string]: string } = {
      'Fire': 'flame',
      'Vehicular Accident': 'car',
      'Flood': 'water',
      'Earthquake': 'earth',
      'Electrical': 'flash'
    }
    return (iconMap[type] || 'warning') as any
  }

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

  const formatShortId = (id: any) => {
    if (id == null) return ''
    const s = String(id)
    if (s.includes('-')) return s.replace(/-/g, '').slice(0, 4).toUpperCase()
    return s.slice(0, 4).toUpperCase()
  }

  const handleImagePress = (images: string[], index: number) => {
    setImageViewerImages(images)
    setSelectedImageIndex(index)
    setShowImageViewer(true)
  }

  const handleImageViewerClose = () => {
    setShowImageViewer(false)
    setImageViewerImages([])
    setSelectedImageIndex(0)
  }

  const handleDetailClose = () => {
    setShowDetail(false)
    setSelectedReport(null)
  }

  const renderReportItem = ({ item }: { item: any }) => {
    const statusInfo = getPatientStatusInfo(item.patient_status || 'No Patient')
    const timestampLabel = new Date(item.incident_datetime).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          setSelectedReport(item)
          setShowDetail(true)
        }}
        className="mx-1"
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
                  style={{
                    backgroundColor: getIncidentColor(item.incident_type) + '1A',
                  }}
                >
                  <Ionicons
                    name={getIncidentIcon(item.incident_type)}
                    size={20}
                    color={getIncidentColor(item.incident_type)}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-lg font-bold text-gray-900"
                    numberOfLines={1}
                  >
                    {item.incident_type}
                  </Text>
                  {item.isOffline && (
                    <View className="mt-1 self-start px-2 py-0.5 rounded-full bg-gray-100">
                      <Text
                        style={{
                          fontSize: 10,
                          color: '#6B7280',
                          fontWeight: '500',
                        }}
                      >
                        OFFLINE
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <Text
                className="text-xs text-gray-400 ml-2"
                numberOfLines={1}
              >
                {timestampLabel}
              </Text>
            </View>

            {item.description ? (
              <Text
                className="mt-2 text-sm text-gray-600"
                numberOfLines={2}
              >
                {item.description}
              </Text>
            ) : null}

            <View className="mt-3 flex-row items-center justify-between">
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
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '600',
                      color: statusInfo.color,
                    }}
                  >
                    {statusInfo.text}
                  </Text>
                </View>
              )}

              <View className="flex-1 flex-row items-center mx-3">
                <Ionicons name="location" size={12} color="#6B7280" />
                <Text
                  numberOfLines={1}
                  style={{
                    marginLeft: 4,
                    fontSize: 11,
                    color: '#6B7280',
                  }}
                >
                  {item.location}
                </Text>
              </View>

              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const mapHtml = React.useMemo(() => {
    if (!coords) return null
    const { latitude, longitude } = coords
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no"/>
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <style>html,body,#map{height:100%;margin:0;padding:0}</style>
        </head>
        <body>
          <div id="map"></div>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <script>
            var map = L.map('map').setView([${latitude}, ${longitude}], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
            L.marker([${latitude}, ${longitude}]).addTo(map).bindPopup('You are here');
          </script>
        </body>
      </html>`
    return html
  }, [coords])

  // Give extra bottom space so map/content never peeks under the Android navbar
  const bottomPadding = insets.bottom + 50

  return (
    <SafeAreaView className={`flex-1 bg-gray-50`} edges={['top','bottom','left','right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPadding }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#4A90E2"]} tintColor={'#4A90E2'} progressBackgroundColor={'#ffffff'} /> }>
        {/* Header */}
        <View className={`bg-white px-6 py-6 border-b border-gray-100 shadow-sm`} style={{ paddingHorizontal: s(24), paddingVertical: s(24) }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 self-center p-1 mt-2 flex-row items-center">
              <Image source={images.logo} style={{ width: Math.round(70 * Math.min(textScale, 1.25)), height: Math.round(70 * Math.min(textScale, 1.25)), resizeMode: 'contain', marginRight: s(20) }} />
              <View>
                <Title style={{ marginBottom: s(4) }}>Silang DRRMO</Title>
                <Subtitle style={{ color: '#4B5563' }}>Report Overviews</Subtitle>
              </View>
            </View>
          </View>
        </View>
        {/* Header with user info */}
        <View className="px-5 pt-4" style={{ paddingHorizontal: s(20), paddingTop: s(16) }}>
          <View
            className="bg-white rounded-2xl border border-gray-100 shadow-sm"
            style={{ padding: s(16) }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View
                  className="w-16 h-16 rounded-full overflow-hidden bg-gray-100"
                  style={{ marginRight: s(16), width: s(64), height: s(64) }}
                >
                  {user?.profile_pic ? (
                    <Image
                      source={{ uri: user.profile_pic }}
                      className="w-full h-full"
                      resizeMode="cover"
                      onError={() => {
                        if (__DEV__) console.warn('Profile picture failed to load:', user.profile_pic);
                      }}
                    />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <Ionicons name="person" size={20} color="#4A90E2" />
                    </View>
                  )}
                </View>
                <View className="flex-1">
                  <Title style={{ color: '#111827', marginBottom: 4 }} numberOfLines={1}>
                    {user?.name || user?.userid || 'User'}
                  </Title>
                  <Body style={{ color: '#6B7280' }} numberOfLines={1}>
                    {user?.barangay_position || 'Responder'}
                  </Body>
                </View>
              </View>
              <View
                className="ml-3 px-3 py-1 rounded-full"
                style={{ backgroundColor: '#DBEAFE' }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: '#1D4ED8',
                  }}
                >
                  {user?.barangay ? `Barangay ${user.barangay}` : 'Barangay —'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View className="px-5 mt-4" style={{ paddingHorizontal: s(20), marginTop: s(16) }}>
          <View className="bg-white rounded-2xl border border-gray-100" style={{ padding: s(16) }}>
            <View className="flex-row justify-between items-center mb-3">
              <ScaledText baseSize={16} className="font-semibold text-gray-900">Overview</ScaledText>
              {isLoading ? <ActivityIndicator size="small" color="#4A90E2" /> : null}
            </View>

            {error ? (
              <ScaledText baseSize={13} className="text-red-600 mb-2">{error}</ScaledText>
            ) : null}

            {/* Summary stats */}
            <View className="flex-row justify-between mb-3">
              <View
                className="flex-1 rounded-2xl bg-white border border-gray-100 shadow-sm mr-2"
                style={{ padding: s(12), borderLeftWidth: 4, borderLeftColor: '#3B82F6' }}
              >
                <ScaledText
                  baseSize={11}
                  className="tracking-wide"
                  style={{ color: '#6B7280', textTransform: 'uppercase' }}
                >
                  Total Reports
                </ScaledText>
                <ScaledText
                  baseSize={24}
                  className="font-bold mt-1"
                  style={{ color: '#111827' }}
                >
                  {reports.length}
                </ScaledText>
                <ScaledText
                  baseSize={11}
                  style={{ color: '#9CA3AF', marginTop: 2 }}
                >
                  All time
                </ScaledText>
              </View>

              <View
                className="flex-1 rounded-2xl bg-white border border-gray-100 shadow-sm ml-2"
                style={{ padding: s(12), borderLeftWidth: 4, borderLeftColor: '#10B981' }}
              >
                <ScaledText
                  baseSize={11}
                  className="tracking-wide"
                  style={{ color: '#6B7280', textTransform: 'uppercase' }}
                >
                  Reports Today
                </ScaledText>
                <ScaledText
                  baseSize={24}
                  className="font-bold mt-1"
                  style={{ color: '#111827' }}
                >
                  {reports.filter(r => new Date(r.incident_datetime).toDateString() === new Date().toDateString()).length}
                </ScaledText>
                <ScaledText
                  baseSize={11}
                  style={{ color: '#9CA3AF', marginTop: 2 }}
                >
                  Since 12:00 AM
                </ScaledText>
              </View>
            </View>

            {/* By incident type */}
            <View style={{ marginTop: s(4) }}>
              <ScaledText baseSize={13} className="font-semibold text-gray-800 mb-2">Reports by Incident Type</ScaledText>
              <View className="flex-row flex-wrap -mx-1">
                {incidentEntries.map(([type, count]: [string, number]) => (
                  <View key={type} className="w-1/2 px-1 mb-2">
                    <View
                      className="rounded-xl border border-gray-100 bg-white shadow-sm"
                      style={{ padding: s(12) }}
                    >
                      <View className="flex-row items-center justify-between">
                        <View
                          className="w-9 h-9 rounded-full items-center justify-center mr-2"
                          style={{ backgroundColor: getIncidentColor(type) + '1A' }}
                        >
                          <Ionicons
                            name={getIncidentIcon(type)}
                            size={18}
                            color={getIncidentColor(type)}
                          />
                        </View>
                        <ScaledText baseSize={18} className="font-bold text-gray-900">
                          {count}
                        </ScaledText>
                      </View>
                      <ScaledText
                        baseSize={12}
                        className="mt-3 font-medium text-gray-600"
                        numberOfLines={1}
                      >
                        {type}
                      </ScaledText>
                    </View>
                  </View>
                ))}
                {incidentEntries.length === 0 && !isLoading ? (
                  <ScaledText baseSize={13} className="text-gray-500">No reports yet.</ScaledText>
                ) : null}
              </View>
            </View>

          </View>
        </View>

        {/* Reports list */}
        <View className="px-5 mt-4" style={{ paddingHorizontal: s(20), marginTop: s(16) }}>
          <Title style={{ marginBottom: 2 }}>Recent Reports</Title>
          <Subtitle style={{ color: '#6B7280', marginBottom: s(8) }}>
            Latest activity from your reports
          </Subtitle>
          {isLoading ? (
            <View className="bg-white rounded-2xl border border-gray-100 items-center" style={{ padding: s(24) }}>
              <ActivityIndicator size="small" color="#4A90E2" />
              <ScaledText baseSize={13} className="text-gray-500 mt-2">Loading...</ScaledText>
            </View>
          ) : (
            <FlatList
              data={reports.slice(0, 3)}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderReportItem}
              ItemSeparatorComponent={() => <View style={{ height: s(12) }} />}
              scrollEnabled={false}
              ListEmptyComponent={<ScaledText baseSize={13} className="text-gray-500">No reports to show.</ScaledText>}
            />
          )}
        </View>

        {/* Current location map */}
        <View className="px-5 mt-4" style={{ paddingHorizontal: s(20), marginTop: s(16) }}>
          <ScaledText baseSize={16} className="font-semibold text-gray-900" style={{ marginBottom: s(8) }}>Your Current Location</ScaledText>
          <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {coords && mapHtml ? (
              <WebView source={{ html: mapHtml }} style={{ height: Math.max(200, Math.min(260, Math.round(220 * Math.min(textScale, 1.2)))) }} />
            ) : (
              <View className="items-center justify-center" style={{ height: 220, padding: s(24) }}>
                {isLocating ? <ActivityIndicator size="small" color="#4A90E2" /> : null}
                <ScaledText baseSize={13} className="text-gray-500 mt-2">{isLocating ? 'Getting your location…' : 'Location unavailable'}</ScaledText>
              </View>
            )}
          </View>
        </View>

        {/* Spacer so content can scroll just above the tab bar */}
        <View style={{ height: insets.bottom + 10 }} />

      </ScrollView>

      {/* Report Detail Modal (mirrors reports screen) */}
      <Modal visible={showDetail} animationType="slide" onRequestClose={handleDetailClose}>
        <View className={`flex-1 bg-white`}>
          <View className={`px-4 py-4 border-b shadow-sm bg-white border-gray-100`}>
            <View className="flex-row items-center justify-between">
              <TouchableOpacity onPress={handleDetailClose} className="p-2">
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
              <Text className={`text-lg font-semibold text-gray-900`}>Report Details</Text>
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
                  <Text className={`text-2xl font-bold mb-1 text-gray-900`}>{selectedReport.incident_type}</Text>
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
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: statusInfo.color }}
                        >
                          {statusInfo.text}
                        </Text>
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
                      <TouchableOpacity key={index} className={`w-20 h-20 rounded-lg overflow-hidden bg-gray-100`} onPress={() => handleImagePress(selectedReport.uploaded_media, index)} activeOpacity={0.8}>
                        <Image source={{ uri: mediaUrl }} className="w-full h-full" resizeMode="cover" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Report Information */}
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
                  <View className="flex-row justify-between mb-2">
                    <Text className={'text-gray-600'}>Patient Status (AVPU):</Text>
                    <Text className={`font-medium text-gray-900`}>
                      {getPatientStatusInfo(selectedReport.patient_status || 'No Patient').text}
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

      {/* Image Viewer Modal (mirrors reports screen) */}
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
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: selectedImageIndex * Dimensions.get('window').width, y: 0 }}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / Dimensions.get('window').width)
                setSelectedImageIndex(index)
              }}
            >
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


    </SafeAreaView>
  )
}

export default Home