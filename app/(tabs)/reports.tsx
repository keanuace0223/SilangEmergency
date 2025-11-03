import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams } from 'expo-router'
import React from 'react'
import { ActivityIndicator, DeviceEventEmitter, Dimensions, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppModal from '../../components/AppModal'
import LocationPicker from '../../components/LocationPicker'
import OfflineModeBanner from '../../components/OfflineModeBanner'
import ScaledText from '../../components/ScaledText'
import SyncStatusIndicator from '../../components/SyncStatusIndicator'
import { Body, Caption, Subtitle, Title } from '../../components/Typography'
import { images } from '../../constants/images'
import { api } from '../../src/api/client'
import { useSettings } from '../../src/context/SettingsContext'
import { useSync } from '../../src/context/SyncContext'
import { useUser } from '../../src/context/UserContext'
import { uploadMultipleReportMedia } from '../../src/lib/supabase'
import { compressImage } from '../../src/utils/imageOptimizer'
import { offlineStorage } from '../../src/utils/offlineStorage'

const Reports = () => {
  const { textScale } = useSettings()
  const { width } = useWindowDimensions()
  const spacingScale = Math.min(textScale, 1.2) * (width < 360 ? 0.95 : width > 720 ? 1.1 : 1)
  const s = (px: number) => Math.round(px * spacingScale)
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets()
  const { user, refreshKey } = useUser()
  const { isOnline, manualSync, retryFailedReports, isSyncing } = useSync()
  const [showAdd, setShowAdd] = React.useState(false)
  const [showDetail, setShowDetail] = React.useState(false)
  const [selectedReport, setSelectedReport] = React.useState<any>(null)
  const [showImageViewer, setShowImageViewer] = React.useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0)
  const [imageViewerImages, setImageViewerImages] = React.useState<string[]>([])
  const [showLocationPicker, setShowLocationPicker] = React.useState(false)
  const [selectedLocation, setSelectedLocation] = React.useState<{ latitude: number; longitude: number; address?: string } | null>(null)
  const [incidentType, setIncidentType] = React.useState<'Fire' | 'Vehicular Accident' | 'Flood' | 'Earthquake' | 'Electrical' | ''>('')
  const [showIncidentMenu, setShowIncidentMenu] = React.useState(false)
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
  const [reports, setReports] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)
  const [activeFilter, setActiveFilter] = React.useState<'All' | 'High' | 'Medium' | 'Low'>('All')
  const [isOptimizingImages, setIsOptimizingImages] = React.useState(false)

  const [modalVisible, setModalVisible] = React.useState(false)
  const [modalTitle, setModalTitle] = React.useState('')
  const [modalMessage, setModalMessage] = React.useState('')
  const [modalIcon, setModalIcon] = React.useState<'checkmark-circle' | 'warning' | 'information-circle'>('information-circle')
  const [modalIconColor, setModalIconColor] = React.useState('#2563EB')
  const [showConfirmSubmit, setShowConfirmSubmit] = React.useState(false)
  const [showConfirmDraft, setShowConfirmDraft] = React.useState(false)
  const [showCallConfirm, setShowCallConfirm] = React.useState(false)

  const showModal = (title: string, message: string, icon: 'checkmark-circle' | 'warning' | 'information-circle', color: string) => {
    setModalTitle(title)
    setModalMessage(message)
    setModalIcon(icon)
    setModalIconColor(color)
    setModalVisible(true)
  }

  const scrollYRef = React.useRef(0)

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

  // Urgency color mapping
  const getUrgencyColor = (urgency: string) => {
    const colorMap: { [key: string]: string } = {
      'Low': '#10B981', // green
      'Moderate': '#F59E0B', // yellow
      'High': '#EF4444' // red
    }
    return colorMap[urgency] || '#6B7280'
  }

  // Format a compact, user-friendly ID from UUID/number
  const formatShortId = (id: any) => {
    if (id == null) return ''
    const s = String(id)
    // If UUID, strip dashes and take first 6 chars
    if (s.includes('-')) return s.replace(/-/g, '').slice(0, 4).toUpperCase()
    // If already short, return uppercased slice
    return s.slice(0, 4).toUpperCase()
  }

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

  // Load reports on component mount
  React.useEffect(() => {
    if (user?.id) { fetchReports() }
  }, [fetchReports, user?.id, refreshKey])

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        fetchReports()
      }
    }, [fetchReports, user?.id, refreshKey])
  )

  // Open Add modal when navigated with ?openAdd=1
  React.useEffect(() => {
    if (params?.openAdd && String(params.openAdd) !== '0') {
      setShowAdd(true)
    }
  }, [params?.openAdd])

  // Listen for add button press from tab bar
  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('OPEN_REPORTS_ADD', () => {
      setShowAdd(true)
    })
    return () => subscription.remove()
  }, [])

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

  // Handle location selection
  const handleLocationSelect = (loc: { latitude: number; longitude: number; address?: string }) => {
    setSelectedLocation(loc)
    setLocation(`${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`)
    setShowLocationPicker(false)
  }

  // Filter reports based on active filter
  const getFilteredReports = () => {
    if (activeFilter === 'All') {
      return reports
    }
    const filterMap: { [key: string]: string } = {
      'High': 'High',
      'Medium': 'Moderate', 
      'Low': 'Low'
    }
    return reports.filter(report => {
      const urgency = report.urgency_level || report.urgency_tag || 'Low';
      return urgency === filterMap[activeFilter];
    })
  }

  // Handle filter change
  const handleFilterChange = (filter: 'All' | 'High' | 'Medium' | 'Low') => {
    setActiveFilter(filter)
  }


  const resetForm = () => {
    setIncidentType('')
    setShowIncidentMenu(false)
    setLocation('')
    setPatientStatus('')
    setDescription('')
    setMedia([])
    setIsSubmitting(false)
    setSelectedLocation(null)
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

  const handleClose = () => {
    setShowAdd(false)
    resetForm()
  }

  const handleSave = () => {
    // Validate first
    if (!incidentType || !location || !patientStatus || !description) {
      showModal('Validation error', 'Please fill in all required fields', 'warning', '#EF4444')
      return
    }
    // Show confirmation modal
    setShowConfirmSubmit(true)
  }

  const handleSaveDraft = () => {
    // Validate first
    if (!incidentType || !location || !patientStatus || !description) {
      showModal('Validation error', 'Please fill in all required fields', 'warning', '#EF4444')
      return
    }
    // Show draft confirmation modal
    setShowConfirmDraft(true)
  }

  const confirmSubmitReport = async () => {
    setShowConfirmSubmit(false)
    setIsSubmitting(true)

    try {
      if (!user?.id) {
        showModal('Not signed in', 'Please sign in again to submit a report.', 'warning', '#EF4444')
        return
      }

      // Check limit before submitting
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

      // Map patientStatus to urgency for backward compatibility
      const urgencyLevel: 'Low' | 'Moderate' | 'High' = 
        patientStatus === 'Alert' ? 'Low' :
        patientStatus === 'Voice' ? 'Moderate' :
        patientStatus === 'Pain' || patientStatus === 'Unresponsive' ? 'High' : 'Low';

      const reportData = {
        user_id: user.id,
        incident_type: incidentType as 'Fire' | 'Vehicular Accident' | 'Flood' | 'Earthquake' | 'Electrical',
        location: selectedLocation ? `${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)}` : location,
        patient_status: patientStatus as 'Alert' | 'Voice' | 'Pain' | 'Unresponsive',
        urgency_level: urgencyLevel,
        urgency_tag: urgencyLevel,
        description,
        uploaded_media: [] as string[],
        incident_datetime: new Date().toISOString(),
      }

      if (isOnline) {
        // Online mode - try to submit directly
        try {
          // Upload selected media to Supabase Storage first (images only for stability)
          let mediaUrls: string[] = []
          if (media.length > 0) {
            const imageUris = media.filter(m => (m as any).type !== 'video').map(m => m.uri)
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
          
          const apiReportData = {
            incidentType: reportData.incident_type,
            location: reportData.location,
            patientStatus: reportData.patient_status,
            description: reportData.description,
            mediaUrls
          }
          
          await api.reports.create(apiReportData, user.id)
          await fetchReports()
          await fetchLimitStatus(); // Refresh limit status after submission
          showModal('Report submitted', 'Your report has been submitted successfully.', 'checkmark-circle', '#16A34A')
          setShowAdd(false); resetForm()
        } catch (error: any) {
          // Handle 429 rate limit error
          if (error?.status === 429 || error?.code === 'RATE_LIMIT_EXCEEDED') {
            showModal(
              'Report limit reached',
              error.message || 'You\'ve reached your report limit of 3 reports per hour. Please wait before submitting another report.',
              'warning',
              '#EF4444'
            );
            await fetchLimitStatus(); // Refresh limit status
            setIsSubmitting(false);
            return;
          }
          // If online submission fails, fall back to offline storage
          console.warn('Online submission failed, saving offline:', error)
          await saveOfflineReport(reportData)
        }
      } else {
        // Offline mode - save locally
        await saveOfflineReport(reportData)
      }
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

  const saveOfflineReport = async (reportData: any) => {
    try {
      // Save media files locally for offline sync
      const localMediaPaths: string[] = []
      if (media.length > 0) {
        // For offline mode, we'll store the local URIs and upload them when syncing
        localMediaPaths.push(...media.map(m => m.uri))
      }

      const offlineReportData = {
        ...reportData,
        local_media_paths: localMediaPaths,
      }

      await offlineStorage.saveOfflineReport(offlineReportData)
      await fetchReports() // Refresh to show the offline report
      
      const message = isOnline 
        ? 'Report saved offline and will sync automatically.'
        : 'Report saved offline. It will sync when you\'re back online.'
      
      showModal('Report saved', message, 'checkmark-circle', '#16A34A')
      setShowAdd(false); resetForm()
    } catch (error) {
      console.error('Error saving offline report:', error)
      throw error
    }
  }

  const confirmSaveDraft = async () => {
    setShowConfirmDraft(false)
    setIsSubmitting(true)

    try {
      if (!user?.id) {
        showModal('Not signed in', 'Please sign in again to save a draft.', 'warning', '#EF4444')
        return
      }

      // Map patientStatus to urgency for backward compatibility
      const urgencyLevel: 'Low' | 'Moderate' | 'High' = 
        patientStatus === 'Alert' ? 'Low' :
        patientStatus === 'Voice' ? 'Moderate' :
        patientStatus === 'Pain' || patientStatus === 'Unresponsive' ? 'High' : 'Low';

      const reportData = {
        user_id: user.id,
        incident_type: incidentType as 'Fire' | 'Vehicular Accident' | 'Flood' | 'Earthquake' | 'Electrical',
        location: selectedLocation ? `${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)}` : location,
        patient_status: patientStatus as 'Alert' | 'Voice' | 'Pain' | 'Unresponsive',
        urgency_level: urgencyLevel,
        urgency_tag: urgencyLevel,
        description,
        uploaded_media: [] as string[],
        incident_datetime: new Date().toISOString(),
      }

      // Save media files locally for draft
      const localMediaPaths: string[] = []
      if (media.length > 0) {
        localMediaPaths.push(...media.map(m => m.uri))
      }

      const draftData = {
        ...reportData,
        local_media_paths: localMediaPaths,
      }

      await offlineStorage.saveDraft(draftData)
      await fetchReports() // Refresh to show the draft
      
      showModal('Draft saved', 'Your report has been saved as a draft. You can edit or submit it later from the Drafts screen.', 'checkmark-circle', '#16A34A')
      setShowAdd(false); resetForm()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save draft'
      showModal('Draft error', msg, 'warning', '#EF4444')
    } finally {
      setIsSubmitting(false)
    }
  }

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Only images for faster processing
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    })
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setIsOptimizingImages(true)
      
      // Add images with loading state first for immediate feedback
      const loadingAssets = result.assets.map(a => ({ 
        uri: a.uri, 
        type: a.type,
        isLoading: true 
      }))
      setMedia(prev => [...prev, ...loadingAssets])
      
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
        setMedia(prev => {
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
    setMedia(prev => prev.filter((_, i) => i !== index))
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
    
    return (
      <TouchableOpacity onPress={() => handleReportPress(item)} activeOpacity={0.8} className="mx-6">
        <View className={`bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-lg`} style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 12 }}>
          <View className={`px-6 py-5 bg-gradient-to-r from-blue-50 to-indigo-50`}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className={`w-12 h-12 rounded-xl bg-white items-center justify-center mr-4 shadow-sm`} style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
                  <Ionicons name={getIncidentIcon(item.incident_type) as any} size={24} color={getIncidentColor(item.incident_type)} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center mb-1">
                    <Subtitle style={{ color: '#111827', fontWeight: '700' }}>{item.incident_type}</Subtitle>
                    {item.isOffline && (
                      <View className="ml-2 px-2 py-1 rounded-full" style={{ backgroundColor: '#F3F4F6' }}>
                        <Caption className="font-medium" style={{ color: '#6B7280', fontSize: 10 }}>OFFLINE</Caption>
                      </View>
                    )}
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="location" size={14} color="#4B5563" />
                    <Body className={`ml-1 font-medium`} style={{ color: '#4B5563' }}>{item.location}</Body>
                  </View>
                </View>
              </View>
              <View className="px-3 py-1.5 rounded-full shadow-sm" style={{ backgroundColor: getUrgencyColor(item.urgency_level || item.urgency_tag || 'Low'), shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }}>
                <Caption className="font-bold tracking-wide" style={{ color: '#FFFFFF' }}>
                  {item.patient_status ? String(item.patient_status).toUpperCase() : String(item.urgency_tag || 'Low').toUpperCase()}
                </Caption>
              </View>
            </View>
          </View>

          <View className="px-6 py-5">
            <Body className={`leading-6 mb-4`} style={{ color: '#374151' }} numberOfLines={2}>{item.description}</Body>
            <View className={`flex-row items-center justify-between pt-3 border-t border-gray-100`}>
              <View className="flex-row items-center">
                <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: syncInfo.color }} />
                <Caption className={`font-medium`} style={{ color: '#6B7280' }}>{syncInfo.text}</Caption>
                {item.sync_status === 'syncing' && (
                  <ActivityIndicator size="small" color={syncInfo.color} style={{ marginLeft: 8 }} />
                )}
              </View>
              <Caption className={`font-medium`} style={{ color: '#9CA3AF' }}>{formatTimestamp(item.incident_datetime)}</Caption>
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
                  {getFilteredReports().length} of {reports.length} {reports.length === 1 ? 'report' : 'reports'}
                  {activeFilter !== 'All' && ` (${activeFilter} priority)`}
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

        {/* Filter Buttons (responsive, horizontal chips) */}
        <View className={`bg-white px-6 py-5 border-b border-gray-100`} style={{ paddingHorizontal: s(24), paddingVertical: s(20) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            {(['All', 'High', 'Medium', 'Low'] as const).map((filter, idx) => {
              const isActive = activeFilter === filter
              const bg = isActive 
                ? (filter === 'High' ? '#EF4444' : filter === 'Medium' ? '#F59E0B' : filter === 'Low' ? '#10B981' : '#4A90E2')
                : 'transparent'
              const border = isActive ? bg : '#D1D5DB'
              const textColor = isActive ? '#FFFFFF' : '#374151'
              const displayLabel = filter === 'Medium' ? 'Med' : filter
              const chipHeight = Math.max(32, Math.round(36 * Math.min(textScale, 1.2)))
              const chipPaddingH = Math.round(10 * Math.min(textScale, 1.1))
              const labelBase = width < 340 ? 10 : (width < 380 ? 11 : 12)
              return (
                <TouchableOpacity
                  key={filter}
                  onPress={() => handleFilterChange(filter)}
                  activeOpacity={0.85}
                  style={{
                    flexGrow: 1,
                    flexBasis: 0,
                    minWidth: 0,
                    height: chipHeight,
                    paddingHorizontal: chipPaddingH,
                    borderRadius: 9999,
                    borderWidth: 1,
                    borderColor: border,
                    backgroundColor: bg,
                    marginRight: idx === 3 ? 0 : s(8),
                    marginBottom: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ScaledText baseSize={labelBase} style={{ fontWeight: '700', color: textColor }} numberOfLines={1} ellipsizeMode="tail">
                    {displayLabel}
                  </ScaledText>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* Reports List */}
        {isLoading ? (
          <View className={`flex-1 items-center justify-center bg-gray-50`}>
            <Text className={`text-lg text-gray-500`}>Loading your reports...</Text>
          </View>
        ) : getFilteredReports().length === 0 ? (
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
                {reports.length === 0 ? 'No Reports Yet' : `No ${activeFilter} Reports`}
              </ScaledText>
              <ScaledText baseSize={16} className={`text-center leading-6 px-2 text-gray-500`}>
                {reports.length === 0 
                  ? 'Tap the + button below to create your first emergency report'
                  : `Try selecting a different filter or create a new report`}
              </ScaledText>
            </View>
          </ScrollView>
        ) : (
          <View className={`flex-1 bg-gray-50`}>
            <FlatList
              data={getFilteredReports()}
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

      {/* Add Report Modal */}
      <Modal visible={showAdd} animationType="slide" onRequestClose={handleClose}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.select({ ios: 'padding', android: undefined })}>
          <View className={`flex-1 bg-white p-4`}>
            <View className="flex-row items-center justify-between pt-6 mb-4">
              <TouchableOpacity onPress={handleClose} className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
              <ScaledText baseSize={24} className="font-bold text-black">New Report</ScaledText>
              <View className="w-10 h-10" />
            </View>
            <View className="pt-6" />
            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 + Math.max(insets.bottom, 16) }} showsVerticalScrollIndicator={false} onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y }} scrollEventThrottle={16}>
              <ScaledText baseSize={14} className="mb-1 text-gray-600">Incident type</ScaledText>
              <View className="relative mb-4">
                <TouchableOpacity onPress={() => setShowIncidentMenu(v => !v)} className={`border rounded-xl px-4 py-4 border-gray-300 bg-white`}>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      {incidentType && (
                        <Ionicons 
                          name={
                            incidentType === 'Fire' ? 'flame' :
                            incidentType === 'Vehicular Accident' ? 'car' :
                            incidentType === 'Flood' ? 'water' :
                            incidentType === 'Earthquake' ? 'earth' :
                            incidentType === 'Electrical' ? 'flash' : 'help'
                          } 
                          size={20} 
                          color={
                            incidentType === 'Fire' ? '#FF6B35' :
                            incidentType === 'Vehicular Accident' ? '#FF4444' :
                            incidentType === 'Flood' ? '#4A90E2' :
                            incidentType === 'Earthquake' ? '#8B4513' :
                            incidentType === 'Electrical' ? '#FFD700' : '#666'
                          } 
                        />
                      )}
                      <ScaledText baseSize={16} className="ml-3 text-black">
                        {incidentType || 'Select incident type'}
                      </ScaledText>
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
                  onPress={pickMedia} 
                  disabled={isOptimizingImages}
                  className={`self-start px-6 py-3 rounded-lg ${isOptimizingImages ? 'bg-gray-200' : 'bg-gray-100'}`}
                >
                  <View className="flex-row items-center">
                    {isOptimizingImages && (
                      <ActivityIndicator size="small" color="#4A90E2" style={{ marginRight: 8 }} />
                    )}
                    <Text className={`font-semibold text-lg ${isOptimizingImages ? 'text-gray-500' : 'text-gray-800'}`}>
                      {isOptimizingImages ? 'Optimizing...' : 'Add photos'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <ScaledText baseSize={14} className="mb-1 text-gray-600">Description</ScaledText>
              <TextInput placeholder="Describe the incident..." value={description} onChangeText={setDescription} className={`border rounded-xl px-4 py-4 text-lg h-48 border-gray-300 bg-white text-black`} placeholderTextColor="#8E8E93" multiline textAlignVertical="top" />
            </ScrollView>

            <View className="absolute bottom-0 left-0 right-0 p-4" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={handleClose} className={`flex-1 h-12 rounded-xl items-center justify-center bg-gray-200`}>
                  <ScaledText baseSize={16} className="font-semibold text-gray-800">Cancel</ScaledText>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveDraft} disabled={isSubmitting} className={`flex-1 h-12 rounded-xl items-center justify-center ${isSubmitting ? 'bg-gray-400' : 'bg-gray-600'}`}>
                  <ScaledText baseSize={16} className="text-white font-semibold">{isSubmitting ? 'Saving...' : 'Save Draft'}</ScaledText>
                </TouchableOpacity>
                <TouchableOpacity 
                  disabled={isSubmitting || (limitStatus?.limitReached ?? false)} 
                  onPress={handleSave} 
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
                <View className={`w-16 h-16 rounded-full items-center justify-center mr-4 shadow-sm bg-blue-50`}>
                  <Ionicons name={getIncidentIcon(selectedReport.incident_type) as any} size={32} color="#4A90E2" />
                </View>
                <View className="flex-1">
                  <ScaledText baseSize={22} className={`font-bold mb-1 text-gray-900`}>{selectedReport.incident_type}</ScaledText>
                  <View className="px-3 py-1 rounded-full self-start" style={{ backgroundColor: getUrgencyColor(selectedReport.urgency_level || selectedReport.urgency_tag || 'Low') + 'E6' }}>
                    <ScaledText baseSize={14} className="font-semibold" style={{ color: '#FFFFFF' }}>
                      {selectedReport.patient_status ? String(selectedReport.patient_status).toUpperCase() : String(selectedReport.urgency_tag || 'Low').toUpperCase()} PRIORITY
                    </ScaledText>
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

      <LocationPicker visible={showLocationPicker} onClose={() => setShowLocationPicker(false)} onLocationSelect={handleLocationSelect} initialLocation={selectedLocation || undefined} />
      
      {/* Submit Confirmation Modal */}
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
              <ScaledText baseSize={20} className="font-bold text-gray-900 mb-2 text-center">Save as Draft</ScaledText>
              <ScaledText baseSize={14} className="text-gray-600 text-center mb-6 leading-6">This will save your report as a draft. You can edit or submit it later from the Drafts screen.</ScaledText>
              <View className="flex-row gap-3 w-full">
                <TouchableOpacity
                  onPress={() => setShowConfirmDraft(false)}
                  className="flex-1 py-3 rounded-xl items-center bg-gray-200"
                >
                  <ScaledText baseSize={16} className="text-gray-800 font-semibold">Cancel</ScaledText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmSaveDraft}
                  className="flex-1 py-3 rounded-xl items-center"
                  style={{ backgroundColor: '#6B7280' }}
                >
                  <ScaledText baseSize={16} className="text-white font-semibold">Save Draft</ScaledText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <AppModal visible={modalVisible} onClose={() => setModalVisible(false)} icon={modalIcon} iconColor={modalIconColor} title={modalTitle} message={modalMessage} actions={[{ label: 'OK', onPress: () => setModalVisible(false), variant: 'primary' }]} />
    </SafeAreaView>
  )
}

export default Reports