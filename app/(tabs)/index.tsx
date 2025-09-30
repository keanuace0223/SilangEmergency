import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
// removed router; using in-place modal like reports screen
import * as ImagePicker from 'expo-image-picker'
import React from 'react'
import { ActivityIndicator, Animated, Dimensions, FlatList, Image, KeyboardAvoidingView, Linking, Modal, PanResponder, Platform, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import LocationPicker from '../../components/LocationPicker'
import { images } from '../../constants/images'
import { api } from '../../src/api/client'
import { useUser } from '../../src/context/UserContext'

const Home = () => {
  const insets = useSafeAreaInsets()
  const { user } = useUser()
  // local detail modal state (mirror reports screen)
  const [showDetail, setShowDetail] = React.useState(false)
  const [selectedReport, setSelectedReport] = React.useState<any | null>(null)
  const [showImageViewer, setShowImageViewer] = React.useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0)
  const [imageViewerImages, setImageViewerImages] = React.useState<string[]>([])

  // Add report state (simplified version inspired by reports screen)
  const [showAdd, setShowAdd] = React.useState(false)
  const [incidentType, setIncidentType] = React.useState<'Fire' | 'Vehicular Accident' | 'Flood' | 'Earthquake' | 'Electrical' | ''>('')
  const [showIncidentMenu, setShowIncidentMenu] = React.useState(false)
  const [showLocationPicker, setShowLocationPicker] = React.useState(false)
  const [selectedLocation, setSelectedLocation] = React.useState<{ latitude: number; longitude: number; address?: string } | null>(null)
  const [location, setLocation] = React.useState('')
  const [urgency, setUrgency] = React.useState<'Low' | 'Moderate' | 'High' | ''>('')
  const [description, setDescription] = React.useState('')
  const [media, setMedia] = React.useState<{ uri: string; type?: string }[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const [reports, setReports] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)

  const [coords, setCoords] = React.useState<{ latitude: number; longitude: number } | null>(null)
  const [isLocating, setIsLocating] = React.useState(false)

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
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      setCoords({ latitude: location.coords.latitude, longitude: location.coords.longitude })
    } catch {
      // ignore silently for dashboard
    } finally {
      setIsLocating(false)
    }
  }, [])
  const handleLocationSelect = (loc: { latitude: number; longitude: number; address?: string }) => {
    setSelectedLocation(loc)
    const latlng = `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`
    setLocation(latlng)
    setShowLocationPicker(false)
  }

  const handlePickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (perm.status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
    if (!result.canceled) {
      const assets = 'assets' in result ? result.assets : []
      const newItems = assets.map(a => ({ uri: a.uri }))
      setMedia((prev: { uri: string; type?: string }[]) => [...prev, ...newItems])
    }
  }

  const resetAddForm = () => {
    setIncidentType('')
    setShowIncidentMenu(false)
    setSelectedLocation(null)
    setLocation('')
    setUrgency('')
    setDescription('')
    setMedia([])
    setIsSubmitting(false)
  }

  const handleSubmitReport = async () => {
    if (!incidentType || !urgency || (!location && !selectedLocation) || !description) {
      return
    }
    setIsSubmitting(true)
    try {
      const payload = {
        incidentType,
        location: location || `${selectedLocation?.latitude?.toFixed(4)}, ${selectedLocation?.longitude?.toFixed(4)}`,
        urgency,
        description,
        mediaUrls: media.map((m: { uri: string; type?: string }) => m.uri),
      }
      await api.reports.create(payload, user?.id || 1)
      await fetchReports()
      setShowAdd(false)
      resetAddForm()
    } catch {
      // noop
    } finally {
      setIsSubmitting(false)
    }
  }

  // Drag-to-close behavior like reports screen
  const translateY = React.useRef(new Animated.Value(0)).current
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_: any, g: any) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_: any, g: any) => {
        const deltaY = g.dy
        const translate = deltaY >= 0 ? deltaY : deltaY * 0.2
        translateY.setValue(translate)
      },
      onPanResponderRelease: (_: any, g: any) => {
        const shouldClose = g.dy > 100 || g.vy > 1.0
        if (shouldClose) {
          Animated.timing(translateY, { toValue: Dimensions.get('window').height, duration: 180, useNativeDriver: true }).start(() => {
            setShowAdd(false)
            translateY.setValue(0)
            resetAddForm()
          })
        } else {
          Animated.spring(translateY, { toValue: 0, bounciness: 2, speed: 22, useNativeDriver: true }).start()
        }
      },
    })
  ).current

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

  const countsByUrgency = React.useMemo(() => {
    const map: Record<string, number> = { Low: 0, Moderate: 0, High: 0 }
    for (const r of reports) {
      const key = r.urgency_tag || 'Unknown'
      map[key] = (map[key] || 0) + 1
    }
    return map
  }, [reports])

  const incidentEntries = React.useMemo(() => Object.entries(countsByIncident), [countsByIncident])
  const urgencyEntries = React.useMemo(() => Object.entries(countsByUrgency), [countsByUrgency])

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

  const getUrgencyColor = (urgency: string) => {
    const colorMap: { [key: string]: string } = {
      'Low': '#10B981',
      'Moderate': '#F59E0B',
      'High': '#EF4444'
    }
    return colorMap[urgency] || '#6B7280'
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

  const renderReportItem = ({ item }: { item: any }) => (
    <TouchableOpacity activeOpacity={0.9} className="bg-white rounded-2xl border border-gray-100 p-4" onPress={() => { setSelectedReport(item); setShowDetail(true) }}>
      <View className="flex-row">
        <View className="w-12 h-12 rounded-xl bg-white items-center justify-center mr-4 shadow-sm" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
          <Ionicons name={getIncidentIcon(item.incident_type)} size={24} color={getIncidentColor(item.incident_type)} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-gray-900" numberOfLines={1}>{item.incident_type}</Text>
            <View className="px-2 py-1 rounded-full" style={{ backgroundColor: getUrgencyColor(item.urgency_tag) + 'E6' }}>
              <Text className="text-[10px] font-bold" style={{ color: '#FFFFFF' }}>{String(item.urgency_tag).toUpperCase()}</Text>
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
    </TouchableOpacity>
  )

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
        <View className={`bg-white px-6 py-6 border-b border-gray-100 shadow-sm`}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 self-center p-1 mt-2 flex-row items-center">
              <Image source={images.logo} style={{ width: 90, height: 90, resizeMode: 'contain', marginRight: 20 }} />
              <View>
                <Text className={`text-5xl font-bold text-blue-500 mb-2`}>Dashboard</Text>
                <Text className={`text-md font-medium text-gray-600`}>Overview of reports and activity</Text>
              </View>
            </View>
          </View>
        </View>
        {/* Header with user info */}
        <View className="px-5 pt-4">
          <View className="bg-white rounded-2xl p-4 border border-gray-100">
            <View className="flex-row items-center">
              <View className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 mr-8">
                {user?.profile_pic ? (
                  <Image source={{ uri: user.profile_pic }} className="w-full h-full" resizeMode="cover" />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Ionicons name="person" size={20} color="#4A90E2" />
                  </View>
                )}
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>{user?.name || 'User'}</Text>
                <Text className="text-gray-600 mt-0.5" numberOfLines={1}>Barangay: <Text className="font-medium">{user?.barangay || '—'}</Text></Text>
                <Text className="text-gray-600" numberOfLines={1}>Position: <Text className="font-medium">{user?.barangay_position || '—'}</Text></Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View className="px-5 mt-4">
          <View className="bg-white rounded-2xl p-4 border border-gray-100">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-base font-semibold text-gray-900">Overview</Text>
              {isLoading ? <ActivityIndicator size="small" color="#4A90E2" /> : null}
            </View>

            {error ? (
              <Text className="text-red-600 text-sm mb-2">{error}</Text>
            ) : null}

            <View className="flex-row justify-between">
              <View className="flex-1 mr-2 rounded-xl p-3" style={{ backgroundColor: '#3B82F6' }}>
                <Text className="text-xs" style={{ color: '#FFFFFF' }}>Total Reports</Text>
                <Text className="text-2xl font-bold mt-1" style={{ color: '#FFFFFF' }}>{reports.length}</Text>
              </View>
              <View className="flex-1 ml-2 rounded-xl p-3" style={{ backgroundColor: '#EF4444' }}>
                <Text className="text-xs" style={{ color: '#FFFFFF' }}>High Urgency</Text>
                <Text className="text-2xl font-bold mt-1" style={{ color: '#FFFFFF' }}>{countsByUrgency['High'] || 0}</Text>
              </View>
            </View>

            {/* By incident type */}
            <View className="mt-4">
              <Text className="text-sm font-semibold text-gray-800 mb-2">Reports by Incident Type</Text>
              <View className="flex-row flex-wrap -mx-1">
                {incidentEntries.map(([type, count]: [string, number]) => (
                  <View key={type} className="w-1/2 px-1 mb-2">
                    <View className="rounded-xl p-3" style={{ backgroundColor: getIncidentColor(type) + 'E6' }}>
                      <View className="flex-row items-center">
                        <Ionicons name={getIncidentIcon(type)} size={18} color="#FFFFFF" />
                        <Text className="text-xs ml-2" style={{ color: '#FFFFFF' }} numberOfLines={1}>{type}</Text>
                      </View>
                      <Text className="text-xl font-bold mt-1" style={{ color: '#FFFFFF' }}>{count}</Text>
                    </View>
                  </View>
                ))}
                {incidentEntries.length === 0 && !isLoading ? (
                  <Text className="text-gray-500 text-sm">No reports yet.</Text>
                ) : null}
              </View>
            </View>

            {/* By urgency */}
            <View className="mt-2">
              <Text className="text-sm font-semibold text-gray-800 mb-2">Reports by Urgency</Text>
              <View className="flex-row flex-wrap -mx-1">
                {urgencyEntries.map(([level, count]: [string, number]) => (
                  <View key={level} className="w-1/3 px-1 mb-2">
                    <View className="rounded-xl p-3 items-center" style={{ backgroundColor: getUrgencyColor(level) + 'E6' }}>
                      <Text className="text-xs" style={{ color: '#FFFFFF' }} numberOfLines={1}>{level}</Text>
                      <Text className="text-xl font-bold mt-1" style={{ color: '#FFFFFF' }}>{count}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Reports list */}
        <View className="px-5 mt-4">
          <Text className="text-base font-semibold text-gray-900 mb-2">Recent Reports</Text>
          {isLoading ? (
            <View className="bg-white rounded-2xl p-6 border border-gray-100 items-center">
              <ActivityIndicator size="small" color="#4A90E2" />
              <Text className="text-gray-500 text-sm mt-2">Loading...</Text>
            </View>
          ) : (
            <FlatList
              data={reports.slice(0, 3)}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderReportItem}
              ItemSeparatorComponent={() => <View className="h-3" />}
              scrollEnabled={false}
              ListEmptyComponent={<Text className="text-gray-500 text-sm">No reports to show.</Text>}
            />
          )}
        </View>

        {/* Current location map */}
        <View className="px-5 mt-4">
          <Text className="text-base font-semibold text-gray-900 mb-2">Your Current Location</Text>
          <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {coords && mapHtml ? (
              <WebView source={{ html: mapHtml }} style={{ height: 220 }} />
            ) : (
              <View className="p-6 items-center justify-center" style={{ height: 220 }}>
                {isLocating ? <ActivityIndicator size="small" color="#4A90E2" /> : null}
                <Text className="text-gray-500 text-sm mt-2">{isLocating ? 'Getting your location…' : 'Location unavailable'}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Spacer so content can scroll just above the tab bar */}
        <View style={{ height: insets.bottom + 10 }} />

      </ScrollView>

      {/* Add Report Modal (mirrors reports screen) */}
      <Modal visible={showAdd} animationType="slide" onRequestClose={() => { setShowAdd(false); }}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.select({ ios: 'padding', android: undefined })}>
          <Animated.View style={{ transform: [{ translateY }] }} className={`flex-1 bg-white p-4`}>
            <View className="absolute top-0 left-0 right-0 h-12 z-50 items-center justify-start pt-4" {...panResponder.panHandlers}>
              <View className={`mt-2 w-12 h-1.5 rounded-full bg-gray-300`} />
            </View>
            <View className="pt-6 mt-6">
              <Text className={`text-3xl font-bold mb-2 text-black`}>New Report</Text>
            </View>
            <View className="pt-6" />
            <ScrollView className="flex-1" contentContainerClassName="pb-28" showsVerticalScrollIndicator={false}>
              <Text className={`text-sm mb-1 text-gray-600`}>Incident type</Text>
              <View className="relative mb-3">
                <TouchableOpacity onPress={() => setShowIncidentMenu((v: boolean) => !v)} className={`border rounded-xl px-3 py-3 border-gray-300 bg-white`}>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      {incidentType && (
                        <Ionicons name={getIncidentIcon(incidentType)} size={20} color={getIncidentColor(incidentType)} />
                      )}
                      <Text className={`text-base ml-3 text-black`}>
                        {incidentType || 'Select incident type'}
                      </Text>
                    </View>
                    <Ionicons name={showIncidentMenu ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
                  </View>
                </TouchableOpacity>
                {showIncidentMenu && (
                  <View className={`absolute left-0 right-0 top-14 rounded-xl overflow-hidden z-50 bg-white border border-gray-300`}>
                    {[
                      { type: 'Fire', icon: 'flame' as const, color: '#FF6B35' },
                      { type: 'Vehicular Accident', icon: 'car' as const, color: '#FF4444' },
                      { type: 'Flood', icon: 'water' as const, color: '#4A90E2' },
                      { type: 'Earthquake', icon: 'earth' as const, color: '#8B4513' },
                      { type: 'Electrical', icon: 'flash' as const, color: '#FFD700' }
                    ].map(opt => (
                      <TouchableOpacity key={opt.type} className={`px-3 py-3 flex-row items-center active:bg-gray-50`} onPress={() => { setIncidentType(opt.type as any); setShowIncidentMenu(false) }}>
                        <Ionicons name={opt.icon} size={20} color={opt.color} />
                        <Text className={`text-base ml-3 text-black`}>{opt.type}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <Text className={`text-sm mb-1 text-gray-600`}>Location</Text>
              <TouchableOpacity onPress={() => setShowLocationPicker(true)} className={`border rounded-xl px-3 py-3 mb-3 flex-row items-center justify-between border-gray-300 bg-white`}>
                <Text className={`text-base ${location ? 'text-black' : 'text-gray-400'}`}>
                  {location || 'Tap to select location on map'}
      </Text>
                <Ionicons name="location" size={20} color="#4A90E2" />
              </TouchableOpacity>

              <Text className={`text-sm mb-1 text-gray-600`}>Urgency</Text>
              <View className="flex-row gap-2 mb-3">
                {(['Low','Moderate','High'] as const).map(level => (
                  <TouchableOpacity key={level} onPress={() => setUrgency(level)} activeOpacity={urgency === level ? 1 : 0.7} className={`px-4 py-2 rounded-full border ${ urgency === level ? (level === 'High' ? 'bg-red-500 border-red-500' : level === 'Moderate' ? 'bg-yellow-500 border-yellow-500' : 'bg-green-500 border-green-500') : 'bg-transparent border-gray-300' }`}>
                    <Text className={`font-semibold ${ urgency === level ? 'text-white' : 'text-gray-700' }`}>{level}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className={`text-sm mb-1 text-gray-600`}>Uploaded Media</Text>
              <View className="mb-2">
                <View className="flex-row flex-wrap gap-2 mb-2">
                  {media.map((m, idx) => (
                    <View key={`${m.uri}-${idx}`} className={`w-20 h-20 rounded-lg overflow-hidden bg-gray-100`}>
                      <Image source={{ uri: m.uri }} className="w-full h-full" resizeMode="cover" />
                    </View>
                  ))}
                </View>
                <TouchableOpacity onPress={handlePickImages} className={`self-start px-4 py-2 rounded-lg bg-gray-100`}>
                  <Text className={`font-semibold text-gray-800`}>Add photos/videos</Text>
                </TouchableOpacity>
              </View>

              <Text className={`text-sm mb-1 text-gray-600`}>Description</Text>
              <TextInput placeholder="Describe the incident..." value={description} onChangeText={setDescription} className={`border rounded-xl px-3 py-3 text-base h-40 border-gray-300 bg-white text-black`} placeholderTextColor="#8E8E93" multiline textAlignVertical="top" />
            </ScrollView>

            <View className="absolute bottom-0 left-0 right-0 p-4">
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => { setShowAdd(false); resetAddForm() }} className={`flex-1 h-12 rounded-xl items-center justify-center bg-gray-200`}>
                  <Text className={`font-semibold text-base text-gray-800`}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={isSubmitting} onPress={handleSubmitReport} className={`flex-1 h-12 rounded-xl items-center justify-center ${isSubmitting ? 'bg-gray-400' : 'bg-[#4A90E2]'}`}>
                  <Text className="text-white font-semibold text-base">{isSubmitting ? 'Submitting...' : 'Submit'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
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
                    <Text className={`font-medium text-gray-900`}>#{selectedReport.id}</Text>
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

      <LocationPicker visible={showLocationPicker} onClose={() => setShowLocationPicker(false)} onLocationSelect={handleLocationSelect} initialLocation={selectedLocation || undefined} />

      {/* Floating buttons: Call and Add */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => Linking.openURL('tel:09356016738')}
        className="absolute right-5 z-50 w-14 h-14 rounded-full bg-red-500 items-center justify-center shadow-lg"
        style={{ bottom: insets.bottom + 150 }}
      >
        <Ionicons name="call" size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setShowAdd(true)}
        className="absolute right-5 z-50 w-14 h-14 rounded-full bg-[#4A90E2] items-center justify-center shadow-lg"
        style={{ bottom: insets.bottom + 90 }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

export default Home