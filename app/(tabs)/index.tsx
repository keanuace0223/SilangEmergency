import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
// removed router; using in-place modal like reports screen
import * as ImagePicker from 'expo-image-picker'
 
import React from 'react'
import { ActivityIndicator, DeviceEventEmitter, Dimensions, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import LocationPicker from '../../components/LocationPicker'
import ScaledText from '../../components/ScaledText'
import { Body, Subtitle, Title } from '../../components/Typography'
import { images } from '../../constants/images'
import { api } from '../../src/api/client'
import { useSettings } from '../../src/context/SettingsContext'
import { useUser } from '../../src/context/UserContext'
import { uploadMultipleReportMedia } from '../../src/lib/supabase'
import { compressImage } from '../../src/utils/imageOptimizer'
import { offlineStorage } from '../../src/utils/offlineStorage'

const Home = () => {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { textScale } = useSettings()
  const spacingScale = Math.min(textScale, 1.2) * (width < 360 ? 0.95 : width > 720 ? 1.1 : 1)
  const s = (px: number) => Math.round(px * spacingScale)
 
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
  const [patientStatus, setPatientStatus] = React.useState<'Alert' | 'Voice' | 'Pain' | 'Unresponsive' | ''>('')
  const [limitStatus, setLimitStatus] = React.useState<{
    count: number;
    remaining: number;
    limitReached: boolean;
    limit: number;
  } | null>(null)
  const [isLoadingLimit, setIsLoadingLimit] = React.useState(false)
  const [description, setDescription] = React.useState('')
  const [media, setMedia] = React.useState<{ uri: string; type?: string; isLoading?: boolean }[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isOptimizingImages, setIsOptimizingImages] = React.useState(false)
  const [showConfirmDraft, setShowConfirmDraft] = React.useState(false)

  const [reports, setReports] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)

  const [coords, setCoords] = React.useState<{ latitude: number; longitude: number } | null>(null)
  const [isLocating, setIsLocating] = React.useState(false)

  // Modal state
  const [showSuccessModal, setShowSuccessModal] = React.useState(false)
  const [modalTitle, setModalTitle] = React.useState('')
  const [modalMessage, setModalMessage] = React.useState('')
  const [modalIcon, setModalIcon] = React.useState<'checkmark-circle' | 'warning' | 'information-circle'>('information-circle')
  const [modalIconColor, setModalIconColor] = React.useState('#2563EB')
  const [showConfirmSubmit, setShowConfirmSubmit] = React.useState(false)
  const [showCallConfirm, setShowCallConfirm] = React.useState(false)

  // Listen for add button press from tab bar (handle all tabs)
  React.useEffect(() => {
    const subscriptions = [
      DeviceEventEmitter.addListener('OPEN_HOME_ADD', () => setShowAdd(true)),
      DeviceEventEmitter.addListener('OPEN_DRAFTS_ADD', () => setShowAdd(true)),
      DeviceEventEmitter.addListener('OPEN_PROFILE_ADD', () => setShowAdd(true)),
    ]
    return () => subscriptions.forEach(sub => sub.remove())
  }, [])

  const showModal = (title: string, message: string, icon: 'checkmark-circle' | 'warning' | 'information-circle', color: string) => {
    setModalTitle(title)
    setModalMessage(message)
    setModalIcon(icon)
    setModalIconColor(color)
    setShowSuccessModal(true)
  }

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
  const handleLocationSelect = (loc: { latitude: number; longitude: number; address?: string }) => {
    setSelectedLocation(loc)
    const latlng = `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`
    setLocation(latlng)
    setShowLocationPicker(false)
  }

  const handlePickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (perm.status !== 'granted') return
    
    const result = await ImagePicker.launchImageLibraryAsync({ 
      allowsMultipleSelection: true, 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Only images for faster processing
      quality: 0.8,
      selectionLimit: 5
    })
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setIsOptimizingImages(true)
      
      // Add images with loading state first for immediate feedback
      const loadingAssets = result.assets.map(a => ({ 
        uri: a.uri, 
        type: a.type,
        isLoading: true 
      }))
      setMedia((prev: { uri: string; type?: string; isLoading?: boolean }[]) => [...prev, ...loadingAssets])
      
      // Optimize images in the background
      try {
        const optimizedAssets = await Promise.all(
          result.assets.map(async (asset, index) => {
            try {
              const optimizedUri = await compressImage(asset.uri, 800) // 800KB max
              return { 
                uri: optimizedUri, 
                type: asset.type,
                isLoading: false 
              }
            } catch (error) {
              console.error(`Failed to optimize image ${index}:`, error)
              return { 
                uri: asset.uri, 
                type: asset.type,
                isLoading: false 
              }
            }
          })
        )
        
        // Replace loading images with optimized ones
        setMedia((prev: { uri: string; type?: string; isLoading?: boolean }[]) => {
          const withoutLoading = prev.filter(m => !m.isLoading)
          return [...withoutLoading, ...optimizedAssets]
        })
      } catch (error) {
        console.error('Error optimizing images:', error)
        showModal('Optimization error', 'Some images could not be optimized, but they were added.', 'warning', '#F59E0B')
      } finally {
        setIsOptimizingImages(false)
      }
    }
  }

  const handleDeleteMedia = (index: number) => {
    setMedia((prev: { uri: string; type?: string; isLoading?: boolean }[]) => prev.filter((_, i) => i !== index))
  }

  const resetAddForm = () => {
    setIncidentType('')
    setShowIncidentMenu(false)
    setSelectedLocation(null)
    setLocation('')
    setPatientStatus('')
    setDescription('')
    setMedia([])
    setIsSubmitting(false)
    setShowConfirmDraft(false)
  }

  // Fetch limit status when modal opens
  const fetchLimitStatus = React.useCallback(async () => {
    if (!user?.id || !showAdd) return;
    
    setIsLoadingLimit(true);
    try {
      const status = await api.reports.getHourlyStatus(user.id);
      setLimitStatus(status);
    } catch (error) {
      console.warn('Failed to fetch limit status:', error);
      setLimitStatus({ count: 0, remaining: 3, limitReached: false, limit: 3 });
    } finally {
      setIsLoadingLimit(false);
    }
  }, [user?.id, showAdd]);

  // Fetch limit status when modal opens
  React.useEffect(() => {
    if (showAdd && user?.id) {
      fetchLimitStatus();
    }
  }, [showAdd, user?.id, fetchLimitStatus]);

  const handleSubmitReport = () => {
    // Validate first
    if (!incidentType || !patientStatus || (!location && !selectedLocation) || !description) {
      showModal('Validation error', 'Please fill in all required fields', 'warning', '#EF4444')
      return
    }
    // Show confirmation modal
    setShowConfirmSubmit(true)
  }

  const handleSaveDraft = () => {
    // Validate required fields for draft
    if (!incidentType || !patientStatus || (!location && !selectedLocation) || !description) {
      showModal('Validation error', 'Please fill in all required fields to save as draft', 'warning', '#EF4444')
      return
    }
    // Show draft confirmation modal
    setShowConfirmDraft(true)
  }

  const confirmSaveDraft = async () => {
    setShowConfirmDraft(false)
    setIsSubmitting(true)
    try {
      if (!user?.id) {
        showModal('Error', 'User not found', 'warning', '#EF4444')
        return
      }

      // Map patientStatus to urgency for backward compatibility
      const urgencyLevel: 'Low' | 'Moderate' | 'High' = 
        patientStatus === 'Alert' ? 'Low' :
        patientStatus === 'Voice' ? 'Moderate' :
        patientStatus === 'Pain' || patientStatus === 'Unresponsive' ? 'High' : 'Low';

      // Prepare draft data
      const draftData = {
        user_id: user.id,
        incident_type: incidentType,
        incident_datetime: new Date().toISOString(),
        location: location || `${selectedLocation?.latitude}, ${selectedLocation?.longitude}`,
        patient_status: patientStatus as 'Alert' | 'Voice' | 'Pain' | 'Unresponsive',
        urgency_level: urgencyLevel,
        urgency_tag: urgencyLevel,
        description: description,
        local_media_paths: media.map(m => m.uri),
        uploaded_media: [] as string[],
      }

      // Save as draft
      await offlineStorage.saveDraft(draftData)
      
      showModal('Success', 'Report saved as draft successfully!', 'checkmark-circle', '#10B981')
      setShowAdd(false)
      resetAddForm()
    } catch (error) {
      console.error('Error saving draft:', error)
      showModal('Error', 'Failed to save draft. Please try again.', 'warning', '#EF4444')
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmSubmitReport = async () => {
    setShowConfirmSubmit(false)
    setIsSubmitting(true)
    try {
      // Upload media first (images only for now)
      let mediaUrls: string[] = []
      if (media.length > 0 && user?.id) {
        const imageUris = media.filter((m: { uri: string; type?: string }) => m.type !== 'video').map((m: { uri: string }) => m.uri)
        const skippedVideos = media.length - imageUris.length
        const { urls, errors } = await uploadMultipleReportMedia(user.id, imageUris)
        if (errors.length > 0 && urls.length === 0) {
          const detail = errors.join('\n')
          showModal('Upload error', `Failed to upload media.\n${detail}`, 'warning', '#EF4444')
          return
        }
        mediaUrls = urls
        if (skippedVideos > 0) {
          showModal('Note', `${skippedVideos} video${skippedVideos > 1 ? 's' : ''} skipped for upload. Images uploaded successfully.`, 'information-circle', '#2563EB')
        }
      }
      // Check limit before submitting
      if (!user?.id) {
        showModal('Not signed in', 'Please sign in again to submit a report.', 'warning', '#EF4444');
        setIsSubmitting(false);
        return;
      }
      
      const currentLimit = await api.reports.getHourlyStatus(user.id);
      if (currentLimit.limitReached) {
        showModal(
          'Report limit reached',
          'You\'ve reached your report limit of 3 reports per hour. Please wait before submitting another report.',
          'warning',
          '#EF4444'
        );
        setIsSubmitting(false);
        await fetchLimitStatus(); // Refresh limit status
        return;
      }

      const payload = {
        incidentType: incidentType as 'Fire' | 'Vehicular Accident' | 'Flood' | 'Earthquake' | 'Electrical',
        location: location || `${selectedLocation?.latitude?.toFixed(4)}, ${selectedLocation?.longitude?.toFixed(4)}`,
        patientStatus: patientStatus as 'Alert' | 'Voice' | 'Pain' | 'Unresponsive',
        description,
        mediaUrls,
      }
      if (!user?.id) { showModal('Not signed in', 'Please sign in again to submit a report.', 'warning', '#EF4444'); return }
      await api.reports.create(payload, user.id)
      await fetchReports()
      await fetchLimitStatus(); // Refresh limit status after submission
      showModal('Report submitted', 'Your report has been submitted successfully.', 'checkmark-circle', '#16A34A')
      setShowAdd(false)
      resetAddForm()
    } catch (error: any) {
      if (error?.status === 429 || error?.code === 'RATE_LIMIT_EXCEEDED') {
        showModal(
          'Report limit reached',
          error.message || 'You\'ve reached your report limit of 3 reports per hour. Please wait before submitting another report.',
          'warning',
          '#EF4444'
        );
        await fetchLimitStatus(); // Refresh limit status
      } else {
        const msg = error instanceof Error ? error.message : 'Failed to submit report'
        showModal('Submission error', msg, 'warning', '#EF4444')
      }
    } finally {
      setIsSubmitting(false)
    }
  }


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
      const key = r.urgency_level || r.urgency_tag || 'Low'
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

  const renderReportItem = ({ item }: { item: any }) => (
    <TouchableOpacity activeOpacity={0.9} className="bg-white rounded-2xl border border-gray-100 p-4" onPress={() => { setSelectedReport(item); setShowDetail(true) }}>
      <View className="flex-row">
        <View className="w-12 h-12 rounded-xl bg-white items-center justify-center mr-4 shadow-sm" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
          <Ionicons name={getIncidentIcon(item.incident_type)} size={24} color={getIncidentColor(item.incident_type)} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-gray-900" numberOfLines={1}>{item.incident_type}</Text>
              <View className="px-2 py-1 rounded-full" style={{ backgroundColor: getUrgencyColor(item.urgency_level || item.urgency_tag || 'Low') + 'E6' }}>
              <Text className="text-[10px] font-bold" style={{ color: '#FFFFFF' }}>
                {item.patient_status ? String(item.patient_status).toUpperCase() : String(item.urgency_tag || 'Low').toUpperCase()}
              </Text>
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
          <View className="bg-[#3B82F6] rounded-2xl border border-gray-100" style={{ padding: s(16) }}>
            <View className="flex-row items-center">
              <View className="w-20 h-20 rounded-full overflow-hidden bg-gray-100" style={{ marginRight: s(32), width: s(80), height: s(80) }}>
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
                <Title style={{ color: '#fff' }} numberOfLines={1}>
                  {user?.name || user?.userid || 'User'}
                </Title>
                <Body style={{ color: '#E5E7EB', marginTop: 2 }} numberOfLines={1}>
                  Barangay: <Text className="font-medium">{user?.barangay || '—'}</Text>
                </Body>
                <Body style={{ color: '#E5E7EB' }} numberOfLines={1}>
                  Position: <Text className="font-medium">{user?.barangay_position || '—'}</Text>
                </Body>
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

            <View className="flex-row justify-between">
              <View className="flex-1 rounded-xl" style={{ backgroundColor: '#3B82F6', padding: s(12), marginRight: s(8) }}>
                <ScaledText baseSize={12} style={{ color: '#FFFFFF' }}>Total Reports</ScaledText>
                <ScaledText baseSize={22} className="font-bold mt-1" style={{ color: '#FFFFFF' }}>{reports.length}</ScaledText>
              </View>
              <View className="flex-1 rounded-xl" style={{ backgroundColor: '#EF4444', padding: s(12), marginLeft: s(8) }}>
                <ScaledText baseSize={12} style={{ color: '#FFFFFF' }}>High Urgency</ScaledText>
                <ScaledText baseSize={22} className="font-bold mt-1" style={{ color: '#FFFFFF' }}>{countsByUrgency['High'] || 0}</ScaledText>
              </View>
            </View>

            {/* By incident type */}
            <View style={{ marginTop: s(16) }}>
              <ScaledText baseSize={13} className="font-semibold text-gray-800 mb-2">Reports by Incident Type</ScaledText>
              <View className="flex-row flex-wrap -mx-1">
                {incidentEntries.map(([type, count]: [string, number]) => (
                  <View key={type} className="w-1/2 px-1 mb-2">
                    <View className="rounded-xl" style={{ backgroundColor: getIncidentColor(type) + 'E6', padding: s(12) }}>
                      <View className="flex-row items-center">
                        <Ionicons name={getIncidentIcon(type)} size={18} color="#FFFFFF" />
                        <ScaledText baseSize={12} className="ml-2" style={{ color: '#FFFFFF' }} numberOfLines={1}>{type}</ScaledText>
                      </View>
                      <ScaledText baseSize={20} className="font-bold mt-1" style={{ color: '#FFFFFF' }}>{count}</ScaledText>
                    </View>
                  </View>
                ))}
                {incidentEntries.length === 0 && !isLoading ? (
                  <ScaledText baseSize={13} className="text-gray-500">No reports yet.</ScaledText>
                ) : null}
              </View>
            </View>

            {/* By urgency */}
            <View style={{ marginTop: s(8) }}>
              <ScaledText baseSize={13} className="font-semibold text-gray-800 mb-2">Reports by Urgency</ScaledText>
              <View className="flex-row flex-wrap -mx-1">
                {urgencyEntries.map(([level, count]: [string, number]) => (
                  <View key={level} className="w-1/3 px-1 mb-2">
                    <View className="rounded-xl items-center" style={{ backgroundColor: getUrgencyColor(level) + 'E6', padding: s(12) }}>
                      <ScaledText baseSize={12} style={{ color: '#FFFFFF' }} numberOfLines={1}>{level}</ScaledText>
                      <ScaledText baseSize={20} className="font-bold mt-1" style={{ color: '#FFFFFF' }}>{count}</ScaledText>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Reports list */}
        <View className="px-5 mt-4" style={{ paddingHorizontal: s(20), marginTop: s(16) }}>
          <ScaledText baseSize={16} className="font-semibold text-gray-900" style={{ marginBottom: s(8) }}>Recent Reports</ScaledText>
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

      {/* Add Report Modal (mirrors reports screen) */}
      <Modal visible={showAdd} animationType="slide" onRequestClose={() => { setShowAdd(false); resetAddForm() }}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.select({ ios: 'padding', android: undefined })}>
          <View className={`flex-1 bg-white p-4`}>
            <View className="flex-row items-center justify-between pt-6 mb-4">
              <TouchableOpacity onPress={() => { setShowAdd(false); resetAddForm() }} className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
              <ScaledText baseSize={24} className="font-bold text-black">New Report</ScaledText>
              <View className="w-10 h-10" />
            </View>
            <View className="pt-6" />
            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 + Math.max(insets.bottom, 16) }} showsVerticalScrollIndicator={false}>
              <ScaledText baseSize={14} className="mb-1 text-gray-600">Incident type</ScaledText>
              <View className="relative mb-4">
                <TouchableOpacity onPress={() => setShowIncidentMenu((v: boolean) => !v)} className={`border rounded-xl px-4 py-4 border-gray-300 bg-white`}>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      {incidentType && (
                        <Ionicons name={getIncidentIcon(incidentType)} size={20} color={getIncidentColor(incidentType)} />
                      )}
                      <ScaledText baseSize={16} className="ml-3 text-black">
                        {incidentType || 'Select incident type'}
                      </ScaledText>
                    </View>
                    <Ionicons name={showIncidentMenu ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
                  </View>
                </TouchableOpacity>
                {showIncidentMenu && (
                  <View className={`absolute left-0 right-0 top-16 rounded-xl overflow-hidden z-50 bg-white border border-gray-300`}>
                    {[
                      { type: 'Fire', icon: 'flame' as const, color: '#FF6B35' },
                      { type: 'Vehicular Accident', icon: 'car' as const, color: '#FF4444' },
                      { type: 'Flood', icon: 'water' as const, color: '#4A90E2' },
                      { type: 'Earthquake', icon: 'earth' as const, color: '#8B4513' },
                      { type: 'Electrical', icon: 'flash' as const, color: '#FFD700' }
                    ].map(opt => (
                      <TouchableOpacity key={opt.type} className={`px-4 py-4 flex-row items-center active:bg-gray-50`} onPress={() => { setIncidentType(opt.type as any); setShowIncidentMenu(false) }}>
                        <Ionicons name={opt.icon} size={20} color={opt.color} />
                        <ScaledText baseSize={16} className="ml-3 text-black">{opt.type}</ScaledText>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <ScaledText baseSize={14} className="mb-1 text-gray-600">Location</ScaledText>
              <TouchableOpacity onPress={() => setShowLocationPicker(true)} className={`border rounded-xl px-4 py-4 mb-4 flex-row items-center justify-between border-gray-300 bg-white`}>
                <ScaledText baseSize={16} className={location ? 'text-black' : 'text-gray-400'}>
                  {location || 'Tap to select location on map'}
                </ScaledText>
                <Ionicons name="location" size={22} color="#4A90E2" />
              </TouchableOpacity>

              {/* Limit Status Display */}
              {limitStatus && (
                <View className={`mx-4 mb-4 p-3 rounded-lg border-2 ${
                  limitStatus.limitReached 
                    ? 'bg-red-50 border-red-300' 
                    : limitStatus.remaining === 1
                    ? 'bg-yellow-50 border-yellow-300'
                    : 'bg-blue-50 border-blue-300'
                }`}>
                  <View className="flex-row items-center justify-between">
                    <ScaledText baseSize={14} className={`font-semibold ${
                      limitStatus.limitReached ? 'text-red-800' : 'text-gray-800'
                    }`}>
                      {limitStatus.limitReached 
                        ? 'Report limit reached'
                        : `You have ${limitStatus.remaining} of ${limitStatus.limit} reports left this hour.`
                      }
                    </ScaledText>
                    {isLoadingLimit && (
                      <ActivityIndicator size="small" color="#4A90E2" />
                    )}
                  </View>
                  {limitStatus.limitReached && (
                    <ScaledText baseSize={12} className="text-red-600 mt-1">
                      Please wait before submitting another report.
                    </ScaledText>
                  )}
                </View>
              )}

              <ScaledText baseSize={14} className="mb-1 text-gray-600">Patient Status (AVPU)</ScaledText>
              <View className="mb-4">
                <View className="flex-row flex-wrap gap-2 mb-2">
                  {([
                    { status: 'Alert', label: 'Alert', color: '#10B981', desc: 'Fully conscious', tagalog: 'Gising at alisto' },
                    { status: 'Voice', label: 'Voice', color: '#3B82F6', desc: 'Responds to voice', tagalog: 'Tumugon sa tinig' },
                    { status: 'Pain', label: 'Pain', color: '#F59E0B', desc: 'Responds to pain', tagalog: 'Tumugon sa sakit' },
                    { status: 'Unresponsive', label: 'Unresponsive', color: '#EF4444', desc: 'No response', tagalog: 'Walang tugon' },
                  ] as const).map(opt => (
                    <TouchableOpacity
                      key={opt.status}
                      onPress={() => setPatientStatus(opt.status)}
                      activeOpacity={0.7}
                      className={`flex-1 min-w-[45%] rounded-xl border-2 p-4 ${
                        patientStatus === opt.status ? 'border-gray-800' : 'border-gray-200'
                      }`}
                      style={{
                        backgroundColor: patientStatus === opt.status ? opt.color + '20' : '#FFFFFF',
                      }}
                    >
                      <View className="flex-row items-center mb-2">
                        <View 
                          className="w-4 h-4 rounded-full mr-2"
                          style={{ backgroundColor: opt.color }}
                        />
                        <ScaledText baseSize={16} className={`font-bold ${patientStatus === opt.status ? 'text-gray-900' : 'text-gray-700'}`}>
                          {opt.label}
                        </ScaledText>
                      </View>
                      <ScaledText baseSize={12} className="text-gray-600 mb-1">{opt.desc}</ScaledText>
                      <ScaledText baseSize={11} className="text-gray-500 italic">{opt.tagalog}</ScaledText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <ScaledText baseSize={14} className="mb-1 text-gray-600">Uploaded Media</ScaledText>
              <View className="mb-2">
                <View className="flex-row flex-wrap gap-2 mb-2">
                  {media.map((m, idx) => (
                    <View key={`${m.uri}-${idx}`} className="relative">
                      <View className={`w-20 h-20 rounded-lg overflow-hidden ${m.isLoading ? 'bg-gray-200' : 'bg-gray-100'}`}>
                        {m.isLoading ? (
                          <View className="w-full h-full items-center justify-center">
                            <ActivityIndicator size="small" color="#4A90E2" />
                          </View>
                        ) : (
                          <Image 
                            source={{ uri: m.uri }} 
                            className="w-full h-full" 
                            resizeMode="cover"
                            fadeDuration={200}
                          />
                        )}
                      </View>
                      {!m.isLoading && (
                        <TouchableOpacity
                          onPress={() => handleDeleteMedia(idx)}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 items-center justify-center shadow-md"
                          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash" size={12} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
                <TouchableOpacity 
                  onPress={handlePickImages} 
                  disabled={isOptimizingImages}
                  className={`self-start px-6 py-3 rounded-lg ${isOptimizingImages ? 'bg-gray-200' : 'bg-gray-100'}`}
                >
                  <View className="flex-row items-center">
                    {isOptimizingImages && (
                      <ActivityIndicator size="small" color="#4A90E2" style={{ marginRight: 8 }} />
                    )}
                    <ScaledText baseSize={16} className={`font-semibold ${isOptimizingImages ? 'text-gray-500' : 'text-gray-800'}`}>
                      {isOptimizingImages ? 'Optimizing...' : 'Add photos'}
                    </ScaledText>
                  </View>
                </TouchableOpacity>
              </View>

              <ScaledText baseSize={14} className="mb-1 text-gray-600">Description</ScaledText>
              <TextInput placeholder="Describe the incident..." value={description} onChangeText={setDescription} className={`border rounded-xl px-4 py-4 text-lg h-48 border-gray-300 bg-white text-black`} placeholderTextColor="#8E8E93" multiline textAlignVertical="top" />
            </ScrollView>

            <View className="absolute bottom-0 left-0 right-0 p-4" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => { setShowAdd(false); resetAddForm() }} className={`flex-1 h-12 rounded-xl items-center justify-center bg-gray-200`}>
                  <ScaledText baseSize={16} className="font-semibold text-gray-800">Cancel</ScaledText>
                </TouchableOpacity>
                <TouchableOpacity disabled={isSubmitting} onPress={handleSaveDraft} className={`flex-1 h-12 rounded-xl items-center justify-center ${isSubmitting ? 'bg-gray-400' : 'bg-[#6B7280]'}`}>
                  <ScaledText baseSize={16} className="text-white font-semibold">{isSubmitting ? 'Saving...' : 'Save Draft'}</ScaledText>
                </TouchableOpacity>
                <TouchableOpacity 
                  disabled={isSubmitting || (limitStatus?.limitReached ?? false)} 
                  onPress={handleSubmitReport} 
                  className={`flex-1 h-12 rounded-xl items-center justify-center ${
                    (isSubmitting || (limitStatus?.limitReached ?? false)) ? 'bg-gray-400' : 'bg-[#4A90E2]'
                  }`}
                >
                  <ScaledText baseSize={16} className="text-white font-semibold">
                    {isSubmitting ? 'Submitting...' : (limitStatus?.limitReached ? 'Limit Reached' : 'Submit')}
                  </ScaledText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
                  <View className="px-3 py-1 rounded-full self-start" style={{ backgroundColor: getUrgencyColor(selectedReport.urgency_level || selectedReport.urgency_tag || 'Low') + 'E6' }}>
                    <Text className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>
                      {selectedReport.patient_status ? String(selectedReport.patient_status).toUpperCase() : String(selectedReport.urgency_tag || 'Low').toUpperCase()}
                    </Text>
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

      {/* Confirmation Modal */}
      <Modal visible={showConfirmSubmit} transparent={true} animationType="fade" onRequestClose={() => setShowConfirmSubmit(false)}>
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 mx-6 max-w-sm w-full">
            <View className="items-center">
              <View className="w-16 h-16 rounded-full items-center justify-center mb-4" style={{ backgroundColor: '#2563EB20' }}>
                <Ionicons name="alert-circle" size={32} color="#2563EB" />
              </View>
              <ScaledText baseSize={20} className="font-bold text-gray-900 mb-2 text-center">Confirm Submission</ScaledText>
              <ScaledText baseSize={14} className="text-gray-600 text-center mb-6 leading-6">Are you sure you want to submit this report? Please review all details before confirming.</ScaledText>
              <View className="flex-row gap-3 w-full">
                <TouchableOpacity
                  onPress={() => setShowConfirmSubmit(false)}
                  className="flex-1 py-3 rounded-xl items-center bg-gray-200"
                >
                  <ScaledText baseSize={16} className="text-gray-800 font-semibold">Cancel</ScaledText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmSubmitReport}
                  className="flex-1 py-3 rounded-xl items-center"
                  style={{ backgroundColor: '#4A90E2' }}
                >
                  <ScaledText baseSize={16} className="text-white font-semibold">Confirm</ScaledText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Draft Confirmation Modal */}
      <Modal visible={showConfirmDraft} transparent={true} animationType="fade" onRequestClose={() => setShowConfirmDraft(false)}>
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 mx-6 max-w-sm w-full">
            <View className="items-center">
              <View className="w-16 h-16 rounded-full items-center justify-center mb-4" style={{ backgroundColor: '#6B728020' }}>
                <Ionicons name="document-outline" size={32} color="#6B7280" />
              </View>
              <Text className="text-xl font-bold text-gray-900 mb-2 text-center">Save as Draft</Text>
              <Text className="text-gray-600 text-center mb-6 leading-6">Are you sure you want to save this report as a draft? You can submit it later from the Drafts screen.</Text>
              <View className="flex-row gap-3 w-full">
                <TouchableOpacity
                  onPress={() => setShowConfirmDraft(false)}
                  className="flex-1 py-3 rounded-xl items-center bg-gray-200"
                >
                  <Text className="text-gray-800 font-semibold text-base">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmSaveDraft}
                  className="flex-1 py-3 rounded-xl items-center"
                  style={{ backgroundColor: '#6B7280' }}
                >
                  <Text className="text-white font-semibold text-base">Save Draft</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent={true} animationType="fade" onRequestClose={() => setShowSuccessModal(false)}>
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 mx-6 max-w-sm w-full">
            <View className="items-center">
              <View className="w-16 h-16 rounded-full items-center justify-center mb-4" style={{ backgroundColor: modalIconColor + '20' }}>
                <Ionicons name={modalIcon} size={32} color={modalIconColor} />
              </View>
              <Text className="text-xl font-bold text-gray-900 mb-2 text-center">{modalTitle}</Text>
              <Text className="text-gray-600 text-center mb-6 leading-6">{modalMessage}</Text>
              <TouchableOpacity
                onPress={() => setShowSuccessModal(false)}
                className="w-full py-3 rounded-xl items-center"
                style={{ backgroundColor: modalIconColor }}
              >
                <Text className="text-white font-semibold text-base">OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

export default Home