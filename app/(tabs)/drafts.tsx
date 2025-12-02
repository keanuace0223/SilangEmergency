import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import React from 'react'
import { ActivityIndicator, Dimensions, FlatList, Image, Modal, RefreshControl, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScaledText from '../../components/ScaledText'
import { Body, Caption, Subtitle, Title } from '../../components/Typography'
import { images } from '../../constants/images'
import { useSync } from '../../src/context/SyncContext'
import { useUser } from '../../src/context/UserContext'
import { offlineStorage } from '../../src/utils/offlineStorage'

const Drafts = () => {
  const insets = useSafeAreaInsets()
  const { user, triggerRefresh } = useUser()
  const { isOnline, manualSync } = useSync()
  
  const [drafts, setDrafts] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)
  const [showDetail, setShowDetail] = React.useState(false)
  const [selectedDraft, setSelectedDraft] = React.useState<any>(null)
  const [showImageViewer, setShowImageViewer] = React.useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0)
  const [imageViewerImages, setImageViewerImages] = React.useState<string[]>([])

  // Fetch drafts and offline reports
  const fetchDrafts = React.useCallback(async () => {
    try {
      if (!user?.id) { setDrafts([]); return }
      setIsLoading(true)
      
      // Get offline reports (these are pending sync)
      const offlineReports = await offlineStorage.getOfflineReports()
      
      // Get saved drafts (these are work-in-progress)
      const savedDrafts = await offlineStorage.getDrafts()
      
        // Mark drafts and offline reports correctly
        const markedOfflineReports = offlineReports.map(item => ({
          ...item,
          isDraft: false,
          isOffline: true,
        }))
        
        const markedDrafts = savedDrafts.map(item => ({
          ...item,
          isDraft: true,
          isOffline: false,
        }))
        
        // Combine and sort by creation date
        const allDrafts = [...markedOfflineReports, ...markedDrafts]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      setDrafts(allDrafts)
    } catch (error) {
      console.error('Error fetching drafts:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  // Refresh drafts
  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchDrafts()
    } catch (error) {
      console.error('Error refreshing drafts:', error)
    } finally {
      setRefreshing(false)
    }
  }

  // Load drafts on component mount
  React.useEffect(() => {
    if (user?.id) { fetchDrafts() }
  }, [fetchDrafts, user?.id])

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        fetchDrafts()
      }
    }, [fetchDrafts, user?.id])
  )

  // Get sync/draft status styling for each item
  const getStatusInfo = (item: any) => {
    // Draft items
    if (item.isDraft) {
      switch (item.sync_status) {
        case 'syncing':
          return {
            label: 'SYNCING',
            textColor: '#1D4ED8',
            bgColor: '#DBEAFE',
            syncing: true,
          }
        case 'error':
          return {
            label: 'SYNC FAILED',
            textColor: '#B91C1C',
            bgColor: '#FEE2E2',
            syncing: false,
          }
        default:
          return {
            label: 'DRAFT',
            textColor: '#4B5563',
            bgColor: '#F3F4F6',
            syncing: false,
          }
      }
    }

    // Offline reports waiting to sync
    switch (item.sync_status) {
      case 'syncing':
        return {
          label: 'SYNCING',
          textColor: '#1D4ED8',
          bgColor: '#DBEAFE',
          syncing: true,
        }
      case 'error':
        return {
          label: 'SYNC FAILED',
          textColor: '#B91C1C',
          bgColor: '#FEE2E2',
          syncing: false,
        }
      default:
        return {
          label: 'WAITING FOR NETWORK',
          textColor: '#B45309',
          bgColor: '#FFEDD5',
          syncing: false,
        }
    }
  }

  // Format timestamp
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

  // Get incident icon
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

  // Get incident color
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

  // Helper to map patient_status to badge color/text
  const getPatientStatusInfo = (status: string) => {
    switch (status) {
      case 'Alert':
        return { text: 'ALERT', color: '#10B981' }
      case 'Voice':
        return { text: 'VOICE', color: '#F59E0B' }
      case 'Pain':
        return { text: 'PAIN', color: '#EF4444' }
      case 'Unresponsive':
        return { text: 'UNRESPONSIVE', color: '#EF4444' }
      case 'No Patient':
        return { text: 'NO PATIENT', color: '#6B7280' }
      default:
        return { text: (status || 'N/A').toUpperCase(), color: '#6B7280' }
    }
  }

  // Handle item press
  const handleItemPress = (item: any) => {
    setSelectedDraft(item)
    setShowDetail(true)
  }

  // Handle detail modal close
  const handleDetailClose = () => {
    setShowDetail(false)
    setSelectedDraft(null)
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

  // Handle submit draft
  const handleSubmitDraft = async (item: any) => {
    try {
      if (item.isDraft) {
        // Submit draft as report (marks it as syncing)
        await offlineStorage.submitDraft(item.id)
        
        // Refresh drafts immediately to show "Syncing..." status
        await fetchDrafts()
        
        // If online, trigger immediate sync
        if (isOnline) {
          try {
            // Trigger manual sync to submit the draft immediately
            await manualSync()
          } catch (syncError) {
            console.error('Error during sync:', syncError)
            // Continue anyway - the draft will sync later automatically
          }
        }
        
        // Trigger refresh of Reports screen to show the newly synced report
        triggerRefresh()
        
        // Refresh drafts again to remove the synced draft from the list
        await fetchDrafts()
        
        handleDetailClose() // Close the detail modal
      }
    } catch (error) {
      console.error('Error submitting draft:', error)
      // On error, refresh drafts to show correct status
      await fetchDrafts()
    }
  }

  // Handle delete draft
  const handleDeleteDraft = async (item: any) => {
    try {
      if (item.isDraft) {
        // Delete draft
        await offlineStorage.deleteDraft(item.id)
      } else {
        // Delete offline report
        await offlineStorage.removeSyncedReport(item.id)
      }
      await fetchDrafts() // Refresh the list
      handleDetailClose() // Close the detail modal
    } catch (error) {
      console.error('Error deleting item:', error)
    }
  }

  // Render draft item
  const renderDraftItem = ({ item }: { item: any }) => {
    const statusInfo = getStatusInfo(item)
    const patientInfo = getPatientStatusInfo(item.patient_status || 'No Patient')
    const isDraft = item.isDraft

    const containerStyle: any = {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    }

    if (isDraft) {
      containerStyle.borderStyle = 'dashed'
      containerStyle.borderWidth = 2
      containerStyle.borderColor = '#E5E7EB'
    } else {
      containerStyle.borderLeftWidth = 4
      containerStyle.borderLeftColor = getIncidentColor(item.incident_type)
    }
    
    return (
      <TouchableOpacity onPress={() => handleItemPress(item)} activeOpacity={0.85} className="mx-4">
        <View
          className="bg-white rounded-2xl border border-gray-100 shadow-sm"
          style={containerStyle}
        >
          <View className="px-4 py-3">
            {/* Header row */}
            <View className="flex-row items-start justify-between">
              <View className="flex-row items-center flex-1 pr-2">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{
                    backgroundColor: isDraft
                      ? '#F3F4F6'
                      : getIncidentColor(item.incident_type) + '1A',
                  }}
                >
                  <Ionicons
                    name={getIncidentIcon(item.incident_type) as any}
                    size={20}
                    color={isDraft ? '#6B7280' : getIncidentColor(item.incident_type)}
                  />
                </View>
                <View className="flex-1">
                  <Subtitle
                    style={{ color: '#111827', fontWeight: '700', fontSize: 16 }}
                    numberOfLines={1}
                  >
                    {item.incident_type || 'Draft Report'}
                  </Subtitle>
                </View>
              </View>
              <Caption
                className="text-xs"
                style={{ color: '#9CA3AF', marginLeft: 8 }}
              >
                {formatTimestamp(item.created_at)}
              </Caption>
            </View>

            {/* Description */}
            {item.description ? (
              <Body
                className="mt-2 text-sm"
                style={{ color: '#4B5563' }}
                numberOfLines={2}
              >
                {item.description}
              </Body>
            ) : null}

            {/* Location */}
            {item.location ? (
              <View className="flex-row items-center mt-2">
                <Ionicons name="location" size={12} color="#6B7280" />
                <Caption
                  numberOfLines={1}
                  style={{
                    marginLeft: 4,
                    fontSize: 11,
                    color: '#6B7280',
                  }}
                >
                  {item.location}
                </Caption>
              </View>
            ) : null}

            {/* Footer: urgency + sync status */}
            <View className="mt-3 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View
                  className="px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: patientInfo.color + '1A' }}
                >
                  <Caption
                    className="font-semibold"
                    style={{ color: patientInfo.color, fontSize: 10 }}
                  >
                    {patientInfo.text}
                  </Caption>
                </View>
              </View>

              <View className="flex-row items-center">
                <View
                  className="px-2.5 py-1 rounded-full flex-row items-center"
                  style={{ backgroundColor: statusInfo.bgColor }}
                >
                  <Caption
                    className="font-semibold"
                    style={{ color: statusInfo.textColor, fontSize: 10 }}
                  >
                    {statusInfo.label}
                  </Caption>
                  {statusInfo.syncing && (
                    <ActivityIndicator
                      size="small"
                      color={statusInfo.textColor}
                      style={{ marginLeft: 6 }}
                    />
                  )}
                </View>
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
        <View className={`bg-white px-6 py-6 border-b border-gray-100 shadow-sm`}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 self-center p-2 mt-4 flex-row items-center">
              <Image source={images.logo} style={{ width: 70, height: 70, resizeMode: 'contain', marginRight: 20 }} />
              <View>
                <Title style={{ marginBottom: 4 }}>Drafts & Offline</Title>
                <Subtitle style={{ color: '#4B5563' }}>
                  {drafts.length} {drafts.length === 1 ? 'item' : 'items'} saved
                </Subtitle>
              </View>
            </View>
          </View>
        </View>

        {/* Content */}
        {isLoading ? (
          <View className={`flex-1 items-center justify-center bg-gray-50`}>
            <Text className={`text-lg text-gray-500`}>Loading drafts...</Text>
          </View>
        ) : drafts.length === 0 ? (
          <View className={`flex-1 items-center justify-center bg-gray-50 px-8`}>
            <View className={`bg-white rounded-3xl shadow-lg items-center mx-4`} style={{ padding: 40 }}>
              <View className="w-20 h-20 bg-gray-50 rounded-full items-center justify-center mb-6">
                <Ionicons name="document-outline" size={40} color="#9CA3AF" />
              </View>
              <ScaledText baseSize={20} className={`font-bold mb-3 text-center text-gray-900`}>
                No Drafts Yet
              </ScaledText>
              <ScaledText baseSize={16} className={`text-center leading-6 px-2 text-gray-500`}>
                Save reports as drafts or create them offline to see them here
              </ScaledText>
            </View>
          </View>
        ) : (
          <View className={`flex-1 bg-gray-50`}>
            <FlatList
              data={drafts}
              renderItem={renderDraftItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingTop: 24, paddingBottom: insets.bottom + 120, paddingHorizontal: 0 }}
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
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            />
          </View>
        )}
      </View>

      {/* Draft Detail Modal */}
      <Modal visible={showDetail} animationType="slide" onRequestClose={handleDetailClose}>
        <View className={`flex-1 bg-white`}>
          <View className={`px-4 py-4 border-b shadow-sm bg-white border-gray-100`}>
            <View className="flex-row items-center justify-between">
              <TouchableOpacity onPress={handleDetailClose} className="p-2">
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
              <ScaledText baseSize={18} className={`font-semibold text-gray-900`}>
                {selectedDraft?.isDraft ? 'Draft Details' : 'Offline Report Details'}
              </ScaledText>
              <View className="w-8" />
            </View>
          </View>

          {selectedDraft && (
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
              <View className="flex-row items-center mb-6">
                <View className={`w-16 h-16 rounded-full items-center justify-center mr-4 shadow-sm bg-blue-50`}>
                  <Ionicons name={getIncidentIcon(selectedDraft.incident_type) as any} size={32} color="#4A90E2" />
                </View>
                <View className="flex-1">
                  <ScaledText baseSize={22} className={`font-bold mb-1 text-gray-900`}>{selectedDraft.incident_type}</ScaledText>
                  {(selectedDraft.incident_type === 'Vehicular Accident' || selectedDraft.incident_type === 'Others') && (() => {
                    const badge = getPatientStatusInfo(selectedDraft.patient_status || 'No Patient')
                    return (
                      <View className="px-3 py-1 rounded-full self-start" style={{ backgroundColor: badge.color + 'E6' }}>
                        <ScaledText baseSize={14} className="font-semibold" style={{ color: '#FFFFFF' }}>
                          {badge.text}
                        </ScaledText>
                      </View>
                    )
                  })()}
                </View>
              </View>

              <View className="mb-6">
                <ScaledText baseSize={18} className={`font-semibold mb-2 text-gray-900`}>Location</ScaledText>
                <View className={`flex-row items-center p-4 rounded-xl bg-gray-50`}>
                  <Ionicons name="location" size={20} color="#4A90E2" />
                  <ScaledText baseSize={16} className={`ml-2 text-gray-700`}>{selectedDraft.location}</ScaledText>
                </View>
              </View>

              <View className="mb-6">
                <ScaledText baseSize={18} className={`font-semibold mb-2 text-gray-900`}>Description</ScaledText>
                <View className={`p-4 rounded-xl bg-gray-50`}>
                  <ScaledText baseSize={16} className={`leading-6 text-gray-700`}>{selectedDraft.description}</ScaledText>
                </View>
              </View>

              {selectedDraft.local_media_paths && selectedDraft.local_media_paths.length > 0 && (
                <View className="mb-6">
                  <ScaledText baseSize={18} className={`font-semibold mb-2 text-gray-900`}>Attached Media</ScaledText>
                  <View className="flex-row flex-wrap gap-2">
                    {selectedDraft.local_media_paths.map((mediaPath: string, index: number) => (
                      <TouchableOpacity 
                        key={index} 
                        className={`w-20 h-20 rounded-lg overflow-hidden bg-gray-100`} 
                        onPress={() => handleImagePress(selectedDraft.local_media_paths, index)} 
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: mediaPath }} className="w-full h-full" resizeMode="cover" />
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
                    <ScaledText baseSize={16} className={`font-medium text-gray-900`}>#{selectedDraft.id.slice(-8).toUpperCase()}</ScaledText>
                  </View>
                  <View className="flex-row justify-between">
                    <ScaledText baseSize={14} className={'text-gray-600'}>Created:</ScaledText>
                    <ScaledText baseSize={16} className={`font-medium text-gray-900`}>
                      {new Date(selectedDraft.created_at).toLocaleDateString()} at {new Date(selectedDraft.created_at).toLocaleTimeString()}
                    </ScaledText>
                  </View>
                  <View className="flex-row justify-between">
                    <ScaledText baseSize={14} className={'text-gray-600'}>Status:</ScaledText>
                    <View className="px-2 py-1 rounded-full" style={{ backgroundColor: selectedDraft.isDraft ? '#F3F4F6' : '#FEF3C7' }}>
                      <ScaledText baseSize={12} className="font-semibold" style={{ color: selectedDraft.isDraft ? '#6B7280' : '#F59E0B' }}>
                        {selectedDraft.isDraft ? 'DRAFT' : 'PENDING SYNC'}
                      </ScaledText>
                    </View>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3 mb-6">
                {selectedDraft.isDraft ? (
                  <>
                    <TouchableOpacity
                      onPress={() => handleSubmitDraft(selectedDraft)}
                      className="flex-1 py-3 rounded-xl items-center"
                      style={{ backgroundColor: '#4A90E2' }}
                    >
                      <ScaledText baseSize={16} className="text-white font-semibold">Submit Report</ScaledText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteDraft(selectedDraft)}
                      className="flex-1 py-3 rounded-xl items-center bg-red-500"
                    >
                      <ScaledText baseSize={16} className="text-white font-semibold">Delete Draft</ScaledText>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleDeleteDraft(selectedDraft)}
                    className="flex-1 py-3 rounded-xl items-center bg-red-500"
                  >
                    <ScaledText baseSize={16} className="text-white font-semibold">Delete Report</ScaledText>
                  </TouchableOpacity>
                )}
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
    </SafeAreaView>
  )
}

export default Drafts