import { Ionicons } from '@expo/vector-icons'
import * as Contacts from 'expo-contacts'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { useFocusEffect, useRouter } from 'expo-router'
import React from 'react'
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppModal from '../../components/AppModal'
import LocationPicker from '../../components/LocationPicker'
import ScaledText from '../../components/ScaledText'
import { api } from '../../src/api/client'
import { useSync } from '../../src/context/SyncContext'
import { useUser } from '../../src/context/UserContext'
import { uploadMultipleReportMedia } from '../../src/lib/supabase'
import { compressImage } from '../../src/utils/imageOptimizer'
import { offlineStorage } from '../../src/utils/offlineStorage'

type ModalAction = {
  label: string
  onPress?: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}

const CreateReport = () => {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useUser()
  const { isOnline } = useSync()
  const scrollViewRef = React.useRef<ScrollView>(null)
  const descriptionInputRef = React.useRef<TextInput>(null)
  const descriptionYPosition = React.useRef<number>(0)

  const [incidentType, setIncidentType] = React.useState<'Fire' | 'Vehicular Accident' | 'Flood' | 'Earthquake' | 'Electrical' | 'Others' | ''>('')
  const [showIncidentMenu, setShowIncidentMenu] = React.useState(false)
  const [showLocationPicker, setShowLocationPicker] = React.useState(false)
  const [selectedLocation, setSelectedLocation] = React.useState<{ latitude: number; longitude: number; address?: string } | null>(null)
  const [location, setLocation] = React.useState('')
  const [contactNumber, setContactNumber] = React.useState('')
  const [patientStatus, setPatientStatus] = React.useState<'Alert' | 'Voice' | 'Pain' | 'Unresponsive' | ''>('')
  const [othersSpecification, setOthersSpecification] = React.useState('')
  const [hasPatient, setHasPatient] = React.useState(false)
  const [description, setDescription] = React.useState('')
  const [media, setMedia] = React.useState<{ uri: string; type?: string; isLoading?: boolean }[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isOptimizingImages, setIsOptimizingImages] = React.useState(false)
  const [showConfirmSubmit, setShowConfirmSubmit] = React.useState(false)
  const [showConfirmDraft, setShowConfirmDraft] = React.useState(false)

  const [showContactModal, setShowContactModal] = React.useState(false)
  const [contacts, setContacts] = React.useState<Contacts.Contact[]>([])
  const [filteredContacts, setFilteredContacts] = React.useState<Contacts.Contact[]>([])
  const [contactSearch, setContactSearch] = React.useState('')
  const [isLoadingContacts, setIsLoadingContacts] = React.useState(false)

  const [mediaModalVisible, setMediaModalVisible] = React.useState(false)

  const [modalVisible, setModalVisible] = React.useState(false)
  const [modalTitle, setModalTitle] = React.useState('')
  const [modalMessage, setModalMessage] = React.useState('')
  const [modalIcon, setModalIcon] = React.useState<'checkmark-circle' | 'warning' | 'information-circle'>('information-circle')
  const [modalIconColor, setModalIconColor] = React.useState('#2563EB')
  const [modalActions, setModalActions] = React.useState<ModalAction[]>([{
    label: 'OK',
    onPress: () => setModalVisible(false),
    variant: 'primary',
  }])

  const showModal = (
    title: string,
    message: string,
    icon: 'checkmark-circle' | 'warning' | 'information-circle',
    color: string,
    actions?: ModalAction[],
  ) => {
    setModalTitle(title)
    setModalMessage(message)
    setModalIcon(icon)
    setModalIconColor(color)
    setModalActions(
      actions && actions.length > 0
        ? actions
        : [{ label: 'OK', onPress: () => setModalVisible(false), variant: 'primary' }]
    )
    setModalVisible(true)
  }


  const initCurrentLocationForReport = React.useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        return
      }

      let coords = (await Location.getLastKnownPositionAsync())?.coords

      if (!coords) {
        coords = (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 0,
        })).coords
      }

      if (!coords) return

      setSelectedLocation({ latitude: coords.latitude, longitude: coords.longitude })
    } catch (error) {
      console.log('Failed to initialize current location for report', error)
    }
  }, [])

  useFocusEffect(
    React.useCallback(() => {
      // Reset core form and modal state whenever this screen gains focus
      resetForm()

      // Ensure the user always starts at the top of the form
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: false })
      }

      // Auto-fill contact number from the latest profile data
      if (user?.contact_number) {
        setContactNumber(user.contact_number || '')
      }

      void initCurrentLocationForReport()

      return () => {
        // No-op cleanup
      }
    }, [user?.contact_number, initCurrentLocationForReport])
  )

  const formatContactNumberFromContact = (raw: string) => {
    if (!raw) return ''

    // Keep digits and leading + for initial processing
    let normalized = raw.trim().replace(/[^\d+]/g, '')

    // Convert +63 or 63 prefixes to 0 for Philippine numbers
    if (normalized.startsWith('+63')) {
      normalized = '0' + normalized.slice(3)
    } else if (normalized.startsWith('63')) {
      normalized = '0' + normalized.slice(2)
    }

    // Strip any remaining non-digits
    normalized = normalized.replace(/\D/g, '')

    // Handle numbers like 9XXXXXXXXX (10 digits starting with 9)
    if (normalized.length === 10 && normalized.startsWith('9')) {
      normalized = '0' + normalized
    }

    return normalized
  }

  const handlePickContact = async () => {
    try {
      setIsLoadingContacts(true)

      const { status } = await Contacts.requestPermissionsAsync()
      if (status !== 'granted') {
        showModal('Permission required', 'Contacts permission is required to pick a phone number.', 'warning', '#EF4444')
        return
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      })

      const contactsWithPhones = (data || []).filter(
        c => c.phoneNumbers && c.phoneNumbers.length > 0
      )

      contactsWithPhones.sort((a, b) => (a.name || '').localeCompare(b.name || ''))

      setContacts(contactsWithPhones)
      setFilteredContacts(contactsWithPhones)
      setContactSearch('')
      setShowContactModal(true)
    } catch (error) {
      console.error('Error fetching contacts:', error)
      showModal('Contacts error', 'Failed to load contacts. Please try again.', 'warning', '#EF4444')
    } finally {
      setIsLoadingContacts(false)
    }
  }

  const handleContactSearchChange = (text: string) => {
    setContactSearch(text)

    if (!text.trim()) {
      setFilteredContacts(contacts)
      return
    }

    const lower = text.toLowerCase()
    const filtered = contacts.filter(c => (c.name || '').toLowerCase().includes(lower))
    setFilteredContacts(filtered)
  }

  const resetForm = () => {
    setIncidentType('')
    setShowIncidentMenu(false)
    setLocation('')
    setContactNumber('')
    setPatientStatus('')
    setDescription('')
    setMedia([])
    setIsSubmitting(false)
    setSelectedLocation(null)
    setOthersSpecification('')
    setHasPatient(false)
     setIsOptimizingImages(false)
     setShowConfirmSubmit(false)
     setShowConfirmDraft(false)
     setShowContactModal(false)
     setShowLocationPicker(false)
     setModalVisible(false)
     setMediaModalVisible(false)
  }

  const handleClose = () => {
    resetForm()
    router.back()
  }

  const handleSave = () => {
    // Validate first
    if (!incidentType || !location || !description) {
      showModal('Validation error', 'Please fill in all required fields', 'warning', '#EF4444')
      return
    }
    if (!contactNumber.trim()) {
      showModal('Validation error', 'Please enter a contact number', 'warning', '#EF4444')
      return
    }
    const normalizedContact = contactNumber.replace(/\D/g, '')
    if (normalizedContact.length !== 11 || !normalizedContact.startsWith('09')) {
      showModal('Validation error', 'Please enter a valid 11-digit mobile number starting with 09', 'warning', '#EF4444')
      return
    }
    // Validate patient status based on incident type
    if (incidentType === 'Vehicular Accident' && !patientStatus) {
      showModal('Validation error', 'Please select patient status (AVPU)', 'warning', '#EF4444')
      return
    }

    // For other incident types, require AVPU only when a patient is involved
    if (incidentType !== 'Vehicular Accident' && hasPatient && !patientStatus) {
      showModal('Validation error', 'Please select patient status (AVPU)', 'warning', '#EF4444')
      return
    }
    // Validate Others specification if Others is selected
    if (incidentType === 'Others' && !othersSpecification.trim()) {
      showModal('Validation error', 'Please specify the incident type', 'warning', '#EF4444')
      return
    }
    // Show confirmation modal
    setShowConfirmSubmit(true)
  }

  const handleSaveDraft = () => {
    // Validate first
    if (!incidentType || !location || !description) {
      showModal('Validation error', 'Please fill in all required fields', 'warning', '#EF4444')
      return
    }
    if (!contactNumber.trim()) {
      showModal('Validation error', 'Please enter a contact number', 'warning', '#EF4444')
      return
    }
    const normalizedContact = contactNumber.replace(/\D/g, '')
    if (normalizedContact.length !== 11 || !normalizedContact.startsWith('09')) {
      showModal('Validation error', 'Please enter a valid 11-digit mobile number starting with 09', 'warning', '#EF4444')
      return
    }
    // Validate urgency/patient status based on incident type
    if (incidentType === 'Vehicular Accident' && !patientStatus) {
      showModal('Validation error', 'Please select patient status (AVPU)', 'warning', '#EF4444')
      return
    }

    // For other incident types, require AVPU only when a patient is involved
    if (incidentType !== 'Vehicular Accident' && hasPatient && !patientStatus) {
      showModal('Validation error', 'Please select patient status (AVPU)', 'warning', '#EF4444')
      return
    }
    // Validate Others specification if Others is selected
    if (incidentType === 'Others' && !othersSpecification.trim()) {
      showModal('Validation error', 'Please specify the incident type', 'warning', '#EF4444')
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


      // Determine final patient status based on incident type
      let finalPatientStatus: 'Alert' | 'Voice' | 'Pain' | 'Unresponsive' | 'No Patient' = 'No Patient'

      if (incidentType === 'Vehicular Accident') {
        // For Vehicular Accident, use AVPU patient status (already validated)
        finalPatientStatus = (patientStatus || 'Alert') as any
      } else {
        // For other incident types, use AVPU only when patient is involved
        if (hasPatient && patientStatus) {
          finalPatientStatus = patientStatus as any
        } else {
          finalPatientStatus = 'No Patient'
        }
      }

      const reportData = {
        user_id: user.id,
        incident_type: incidentType === 'Others' ? othersSpecification : (incidentType as 'Fire' | 'Vehicular Accident' | 'Flood' | 'Earthquake' | 'Electrical'),
        location: selectedLocation ? `${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)}` : location,
        contact_number: contactNumber,
        patient_status: finalPatientStatus as any,
        description,
        uploaded_media: [] as string[],
        incident_datetime: new Date().toISOString(),
        status: 'PENDING' as const,
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
            contactNumber: reportData.contact_number,
            patientStatus: reportData.patient_status,
            description: reportData.description,
            mediaUrls
          }
          
          await api.reports.create(apiReportData, user.id)
          showModal('Report submitted', 'Your report has been submitted successfully.', 'checkmark-circle', '#16A34A')
          setTimeout(() => {
            resetForm()
            router.replace('/(tabs)/reports')
          }, 1500)
        } catch (error: any) {
          // If online submission fails, fall back to offline storage
          console.warn('Online submission failed, saving offline:', error)
          await saveOfflineReport(reportData)
        }
      } else {
        // Offline mode - save locally
        await saveOfflineReport(reportData)
      }
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : 'Failed to submit report'
      showModal('Submission error', msg, 'warning', '#EF4444')
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
      
      const message = isOnline 
        ? 'Report saved offline and will sync automatically.'
        : 'Report saved offline. It will sync when you\'re back online.'
      
      showModal('Report saved', message, 'checkmark-circle', '#16A34A')
      setTimeout(() => {
        resetForm()
        router.replace('/(tabs)/reports')
      }, 1500)
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

      // Determine urgency level based on incident type
      let finalPatientStatus: 'Alert' | 'Voice' | 'Pain' | 'Unresponsive' | 'No Patient' = 'No Patient'

      if (incidentType === 'Vehicular Accident') {
        // For Vehicular Accident, use AVPU patient status (already validated)
        finalPatientStatus = (patientStatus || 'Alert') as any
      } else {
        // For other incident types, use AVPU only when patient is involved
        if (hasPatient && patientStatus) {
          finalPatientStatus = patientStatus as any
        } else {
          finalPatientStatus = 'No Patient'
        }
      }

      const reportData = {
        user_id: user.id,
        incident_type: incidentType === 'Others' ? othersSpecification : (incidentType as 'Fire' | 'Vehicular Accident' | 'Flood' | 'Earthquake' | 'Electrical'),
        location: selectedLocation ? `${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)}` : location,
        contact_number: contactNumber,
        patient_status: finalPatientStatus as any,
        description,
        uploaded_media: [] as string[],
        incident_datetime: new Date().toISOString(),
        status: 'PENDING' as const,
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
      
      showModal('Draft saved', 'Your report has been saved as a draft. You can edit or submit it later from the Drafts screen.', 'checkmark-circle', '#16A34A')
      setTimeout(() => {
        resetForm()
        router.back()
      }, 1500)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save draft'
      showModal('Draft error', msg, 'warning', '#EF4444')
    } finally {
      setIsSubmitting(false)
    }
  }

  const processSelectedAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (!assets || assets.length === 0) return

    setIsOptimizingImages(true)

    // Add images with loading state first for immediate feedback
    const loadingAssets = assets.map(a => ({
      uri: a.uri,
      type: a.type,
      isLoading: true,
    }))
    setMedia(prev => [...prev, ...loadingAssets])

    // Optimize images in the background
    try {
      const optimizedAssets = await Promise.all(
        assets.map(async (asset, index) => {
          try {
            const optimizedUri = await compressImage(asset.uri, 800) // 800KB max
            return {
              uri: optimizedUri,
              type: asset.type,
              isLoading: false,
            }
          } catch (error) {
            console.error(`Failed to optimize image ${index}:`, error)
            return {
              uri: asset.uri,
              type: asset.type,
              isLoading: false,
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

  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      showModal('Permission required', 'Media library permission is required to select photos.', 'warning', '#EF4444')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Only images for faster processing
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await processSelectedAssets(result.assets)
    }
  }

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      showModal('Permission required', 'Camera permission is required to take a photo.', 'warning', '#EF4444')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await processSelectedAssets(result.assets)
    }
  }

  const handleCameraLaunch = async () => {
    setMediaModalVisible(false)
    await handleTakePhoto()
  }

  const handleGalleryLaunch = async () => {
    setMediaModalVisible(false)
    await handlePickFromGallery()
  }

  const handleDeleteMedia = (index: number) => {
    setMedia(prev => prev.filter((_, i) => i !== index))
  }

  // Handle location selection
  const handleLocationSelect = (loc: { latitude: number; longitude: number; address?: string }) => {
    setSelectedLocation(loc)
    setLocation(`${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`)
    setShowLocationPicker(false)
  }

  // Memoize AVPU options to prevent re-creation on every render
  const avpuOptions = React.useMemo(() => [
    { status: 'Alert' as const, label: 'Alert', color: '#10B981', bgColor: '#10B981', borderColor: '#10B981', tagalog: 'Gising at alisto', icon: 'eye-outline' as const },
    { status: 'Voice' as const, label: 'Voice', color: '#F59E0B', bgColor: '#F59E0B', borderColor: '#F59E0B', tagalog: 'Tumugon sa tinig', icon: 'volume-medium-outline' as const },
    { status: 'Pain' as const, label: 'Pain', color: '#EF4444', bgColor: '#EF4444', borderColor: '#EF4444', tagalog: 'Tumugon sa sakit', icon: 'alert-circle-outline' as const },
    { status: 'Unresponsive' as const, label: 'Unresponsive', color: '#6B7280', bgColor: '#6B7280', borderColor: '#6B7280', tagalog: 'Walang tugon', icon: 'eye-off-outline' as const },
  ], [])

  // Memoized AVPU button component to prevent NativeWind from processing during state updates
  const AVPUButtonComponent = ({ opt, isSelected, onPress }: { opt: typeof avpuOptions[0], isSelected: boolean, onPress: () => void }) => {
    const baseClassName = 'flex-1 min-w-[48%] rounded-xl border p-3'
    const selectedClassName = 'shadow-lg'
    const unselectedClassName = 'bg-white border-gray-300'
    
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        className={isSelected ? `${baseClassName} ${selectedClassName}` : `${baseClassName} ${unselectedClassName}`}
        style={isSelected ? {
          backgroundColor: opt.bgColor,
          borderColor: opt.borderColor,
          shadowColor: opt.color,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 5,
          elevation: 8,
        } : {}}
      >
        <View className="flex-row items-center mb-1">
          <Ionicons
            name={opt.icon}
            size={20}
            color={isSelected ? 'white' : opt.color}
            style={{ marginRight: 8 }}
          />
          <ScaledText
            baseSize={18}
            className={isSelected ? 'font-semibold text-white' : 'font-semibold text-gray-900'}
          >
            {opt.label}
          </ScaledText>
        </View>
        <ScaledText
          baseSize={12}
          className={isSelected ? 'text-white' : 'text-gray-600'}
        >
          {opt.tagalog}
        </ScaledText>
      </TouchableOpacity>
    )
  }
  
  AVPUButtonComponent.displayName = 'AVPUButton'
  
  const AVPUButton = React.memo(AVPUButtonComponent)

  // (Urgency buttons removed; app now relies solely on patient_status AVPU and 'No Patient')

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      className="flex-1 bg-white"
    >
      <View className="flex-1">
        {/* HEADER */}
        <View 
          className="flex-row items-center justify-between border-b border-gray-200 px-4"
          style={{ 
            paddingTop: insets.top + 8,
            paddingBottom: 16 
          }}
        >
          <TouchableOpacity onPress={handleClose} className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
          <ScaledText baseSize={24} className="font-bold text-black">New Report</ScaledText>
          <View className="w-10 h-10" />
        </View>

        {/* SCROLLABLE FORM CONTENT */}
        <ScrollView 
          ref={scrollViewRef}
          className="flex-1"
          contentContainerStyle={{ 
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 400 // Increased significantly to account for keyboard + footer + safe area
          }} 
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          keyboardDismissMode="interactive"
        >
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
                        incidentType === 'Electrical' ? 'flash' :
                        incidentType === 'Others' ? 'help-circle-outline' : 'help'
                      } 
                      size={20} 
                      color={
                        incidentType === 'Fire' ? '#FF6B35' :
                        incidentType === 'Vehicular Accident' ? '#FF4444' :
                        incidentType === 'Flood' ? '#4A90E2' :
                        incidentType === 'Earthquake' ? '#8B4513' :
                        incidentType === 'Electrical' ? '#FFD700' :
                        incidentType === 'Others' ? '#6B7280' : '#666'
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
                  { type: 'Electrical', icon: 'flash' as const, color: '#FFD700' },
                  { type: 'Others', icon: 'help-circle-outline' as const, color: '#6B7280' }
                ].map(opt => (
                  <TouchableOpacity key={opt.type} className={`px-4 py-4 flex-row items-center active:bg-gray-50`} onPress={() => { 
                    setIncidentType(opt.type as any); 
                    setShowIncidentMenu(false);
                    // Reset urgency/patient status when changing incident type
                    setPatientStatus('')
                    setOthersSpecification('')
                    setHasPatient(false)
                  }}>
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

          <ScaledText baseSize={14} className="mb-1 text-gray-600">Contact Number</ScaledText>
          <View className="flex-row items-center border rounded-xl px-4 py-4 mb-4 border-gray-300 bg-white">
            <TextInput
              placeholder="e.g. 0912 345 6789"
              value={contactNumber}
              onChangeText={setContactNumber}
              keyboardType="phone-pad"
              className="flex-1 text-black"
              style={{ paddingVertical: 0, textAlignVertical: 'center' }}
              placeholderTextColor="#8E8E93"
            />
            <TouchableOpacity
              onPress={handlePickContact}
              disabled={isLoadingContacts}
              className="ml-3 items-center justify-center"
            >
              {isLoadingContacts ? (
                <ActivityIndicator size="small" color="#4A90E2" />
              ) : (
                <Ionicons name="people-circle-outline" size={26} color="#4A90E2" />
              )}
            </TouchableOpacity>
          </View>


          {/* Conditional Urgency/Patient Status based on incident type */}
          {incidentType === 'Vehicular Accident' ? (
            <>
              <ScaledText baseSize={14} className="mb-1 text-gray-600">Patient Status (AVPU)</ScaledText>
              <View className="mb-4">
                <View className="flex-row flex-wrap gap-2 mb-2">
                  {avpuOptions.map(opt => (
                    <AVPUButton 
                      key={opt.status} 
                      opt={opt} 
                      isSelected={patientStatus === opt.status}
                      onPress={() => setPatientStatus(opt.status)}
                    />
                  ))}
                </View>
              </View>
            </>
          ) : incidentType === 'Fire' || incidentType === 'Flood' || incidentType === 'Earthquake' || incidentType === 'Electrical' || incidentType === 'Others' ? (
            <>
              <TouchableOpacity 
                onPress={() => setHasPatient(!hasPatient)}
                activeOpacity={1}
                className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-200 flex-row items-center"
              >
                <View className={`w-6 h-6 rounded border-2 items-center justify-center mr-3 ${hasPatient ? 'bg-blue-500 border-blue-500' : 'border-gray-400'}`}>
                  {hasPatient && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </View>
                <ScaledText baseSize={14} className="text-gray-700 font-semibold flex-1">
                  Patient involved in this incident
                </ScaledText>
              </TouchableOpacity>
              
              {hasPatient && (
                <>
                  <ScaledText baseSize={14} className="mb-1 text-gray-600">Patient Status (AVPU)</ScaledText>
                  <View className="mb-4">
                    <View className="flex-row flex-wrap gap-2 mb-2">
                      {avpuOptions.map(opt => (
                        <AVPUButton 
                          key={opt.status} 
                          opt={opt} 
                          isSelected={patientStatus === opt.status}
                          onPress={() => setPatientStatus(opt.status)}
                        />
                      ))}
                    </View>
                  </View>
                </>
              )}
            </>
          ) : null}

          {/* Others specification field */}
          {incidentType === 'Others' && (
            <>
              <ScaledText baseSize={14} className="mb-1 text-gray-600">Please specify incident type</ScaledText>
              <TextInput 
                placeholder="Enter incident type..." 
                value={othersSpecification} 
                onChangeText={setOthersSpecification} 
                className={`border rounded-xl px-4 py-4 text-base border-gray-300 bg-white text-black mb-4`} 
                placeholderTextColor="#8E8E93"
              />
            </>
          )}

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
              onPress={() => setMediaModalVisible(true)} 
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

          <View 
            onLayout={(event) => {
              // Store description field position for scrolling
              const { y } = event.nativeEvent.layout;
              descriptionYPosition.current = y;
            }}
          >
            <ScaledText baseSize={14} className="mb-1 text-gray-600">Description</ScaledText>
            <TextInput 
              ref={descriptionInputRef}
              placeholder="Describe the incident..." 
              value={description} 
              onChangeText={setDescription} 
              className={`border rounded-xl px-4 py-4 text-lg border-gray-300 bg-white text-black`} 
              placeholderTextColor="#8E8E93" 
              multiline 
              textAlignVertical="top"
              style={{ minHeight: 120 }}
              onFocus={() => {
                // Auto-scroll to reveal description field when tapped
                // Use multiple attempts with increasing delays to ensure it works
                const scrollToDescription = () => {
                  if (!scrollViewRef.current) return;
                  
                  // Method 1: Scroll to end (most reliable)
                  scrollViewRef.current.scrollToEnd({ animated: true });
                  
                  // Method 2: If we have position, try scrollTo as well
                  if (descriptionYPosition.current > 0) {
                    setTimeout(() => {
                      if (scrollViewRef.current) {
                        scrollViewRef.current.scrollTo({
                          y: Math.max(0, descriptionYPosition.current - 200),
                          animated: true
                        });
                      }
                    }, 100);
                  }
                };
                
                // Try immediately
                scrollToDescription();
                
                // Try after short delay (keyboard animation start)
                setTimeout(scrollToDescription, 200);
                
                // Try after longer delay (keyboard fully shown)
                setTimeout(scrollToDescription, 500);
                
                // Final attempt
                setTimeout(scrollToDescription, 800);
              }}
            />
          </View>
        </ScrollView>

        {/* FOOTER (Outside ScrollView) */}
        <View
          className="absolute bottom-0 left-0 right-0 flex-row gap-3 bg-white border-t border-gray-200 px-4 pt-4"
          style={{
            paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16
          }}
        >
          <TouchableOpacity onPress={handleClose} className={`flex-1 h-12 rounded-xl items-center justify-center bg-gray-200`}>
            <ScaledText baseSize={16} className="font-semibold text-gray-800">Cancel</ScaledText>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSaveDraft} disabled={isSubmitting} className={`flex-1 h-12 rounded-xl items-center justify-center ${isSubmitting ? 'bg-gray-400' : 'bg-gray-600'}`}>
            <ScaledText baseSize={16} className="text-white font-semibold">{isSubmitting ? 'Saving...' : 'Save Draft'}</ScaledText>
          </TouchableOpacity>
          <TouchableOpacity 
            disabled={isSubmitting}
            onPress={handleSave} 
            className={`flex-1 h-12 rounded-xl items-center justify-center ${
              isSubmitting ? 'bg-gray-400' : 'bg-[#4A90E2]'
            }`}
          >
            <ScaledText baseSize={16} className="text-white font-semibold">
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </ScaledText>
          </TouchableOpacity>
        </View>
      </View>

      {showLocationPicker && (
        <LocationPicker visible={true} onClose={() => setShowLocationPicker(false)} onLocationSelect={handleLocationSelect} initialLocation={selectedLocation || undefined} />
      )}
      
      {showContactModal && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowContactModal(false)}
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="bg-white rounded-t-3xl pt-4 px-4 pb-6 max-h-[80%]">
              <View className="flex-row items-center justify-between mb-3">
                <ScaledText baseSize={18} className="font-bold text-gray-900">Pick Contact</ScaledText>
                <TouchableOpacity
                  onPress={() => setShowContactModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View className="mb-3">
                <View className="flex-row items-center rounded-xl border border-gray-300 bg-gray-50 px-3">
                  <Ionicons name="search" size={18} color="#9CA3AF" />
                  <TextInput
                    placeholder="Search contacts"
                    value={contactSearch}
                    onChangeText={handleContactSearchChange}
                    className="flex-1 px-2 py-2 text-base text-black"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              {isLoadingContacts ? (
                <View className="py-8 items-center justify-center">
                  <ActivityIndicator size="small" color="#4A90E2" />
                  <ScaledText baseSize={14} className="mt-2 text-gray-500">
                    Loading contacts...
                  </ScaledText>
                </View>
              ) : (
                <FlatList
                  data={filteredContacts}
                  keyExtractor={(_, index) => index.toString()}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    if (!item.phoneNumbers || item.phoneNumbers.length === 0) {
                      return null
                    }

                    const mobilePhone =
                      item.phoneNumbers.find(p => (p.label || '').toLowerCase().includes('mobile')) ||
                      item.phoneNumbers[0]

                    const rawNumber = mobilePhone.number || ''

                    return (
                      <TouchableOpacity
                        onPress={() => {
                          const formatted = formatContactNumberFromContact(rawNumber)
                          if (formatted) {
                            setContactNumber(formatted)
                          }
                          setShowContactModal(false)
                        }}
                        className="py-3 border-b border-gray-100"
                      >
                        <ScaledText baseSize={16} className="text-gray-900">
                          {item.name || 'Unnamed contact'}
                        </ScaledText>
                        <ScaledText baseSize={14} className="text-gray-600 mt-0.5">
                          {rawNumber}
                        </ScaledText>
                      </TouchableOpacity>
                    )
                  }}
                  ListEmptyComponent={
                    <View className="py-8 items-center justify-center">
                      <ScaledText baseSize={14} className="text-gray-500">
                        No contacts with phone numbers found.
                      </ScaledText>
                    </View>
                  }
                  style={{ maxHeight: 360 }}
                />
              )}
            </View>
          </View>
        </Modal>
      )}
      
      {/* Media Source Selection Modal */}
      {mediaModalVisible && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setMediaModalVisible(false)}
        >
          <View className="flex-1 items-center justify-center bg-black/50">
            <View className="bg-white rounded-2xl p-6 w-80">
              <ScaledText baseSize={18} className="font-bold text-blue-500 text-center mb-4">Add Photo</ScaledText>

              <TouchableOpacity
                onPress={handleCameraLaunch}
                className="flex-row items-center justify-center bg-gray-100 rounded-xl py-3 mb-3"
              >
                <Ionicons name="camera" size={20} color="#111827" style={{ marginRight: 8 }} />
                <ScaledText baseSize={16} className="font-semibold text-gray-900">
                  Take Photo
                </ScaledText>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleGalleryLaunch}
                className="flex-row items-center justify-center bg-gray-100 rounded-xl py-3 mb-4"
              >
                <Ionicons name="images" size={20} color="#111827" style={{ marginRight: 8 }} />
                <ScaledText baseSize={16} className="font-semibold text-gray-900">
                  Choose from Gallery
                </ScaledText>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMediaModalVisible(false)}
                className="items-center pt-1"
              >
                <ScaledText baseSize={14} className="font-semibold text-gray-500">
                  Cancel
                </ScaledText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      
      {/* Submit Confirmation Modal */}
      {showConfirmSubmit && (
        <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => setShowConfirmSubmit(false)}>
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
      )}

      {/* Draft Confirmation Modal */}
      {showConfirmDraft && (
        <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => setShowConfirmDraft(false)}>
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
      )}

      {modalVisible && (
        <AppModal
          visible={true}
          onClose={() => setModalVisible(false)}
          icon={modalIcon}
          iconColor={modalIconColor}
          title={modalTitle}
          message={modalMessage}
          actions={modalActions}
        />
      )}
    </KeyboardAvoidingView>
  )
}

export default CreateReport

