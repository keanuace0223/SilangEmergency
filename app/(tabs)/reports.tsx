import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import React from 'react'
import { Animated, Dimensions, FlatList, Image, KeyboardAvoidingView, Linking, Modal, PanResponder, Platform, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppModal from '../../components/AppModal'
import LocationPicker from '../../components/LocationPicker'
import { images } from '../../constants/images'
import { api } from '../../src/api/client'
import { useUser } from '../../src/context/UserContext'

const Reports = () => {
  const insets = useSafeAreaInsets()
  const { user } = useUser()
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
  const [urgency, setUrgency] = React.useState<'Low' | 'Moderate' | 'High' | ''>('')
  const [description, setDescription] = React.useState('')
  const [media, setMedia] = React.useState<{ uri: string; type?: string }[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [reports, setReports] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)
  const [activeFilter, setActiveFilter] = React.useState<'All' | 'High' | 'Medium' | 'Low'>('All')
  const translateY = React.useRef(new Animated.Value(0)).current

  const [modalVisible, setModalVisible] = React.useState(false)
  const [modalTitle, setModalTitle] = React.useState('')
  const [modalMessage, setModalMessage] = React.useState('')
  const [modalIcon, setModalIcon] = React.useState<'checkmark-circle' | 'warning' | 'information-circle'>('information-circle')
  const [modalIconColor, setModalIconColor] = React.useState('#2563EB')

  const showModal = (title: string, message: string, icon: 'checkmark-circle' | 'warning' | 'information-circle', color: string) => {
    setModalTitle(title)
    setModalMessage(message)
    setModalIcon(icon)
    setModalIconColor(color)
    setModalVisible(true)
  }

  const screenHeight = Dimensions.get('window').height

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

  // Fetch reports from API
  const fetchReports = React.useCallback(async () => {
    try {
      if (!user?.id) {
        setReports([])
        return
      }
      setIsLoading(true)
      const reportsData = await api.reports.getAll(user.id)
      setReports(reportsData)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch reports'
      showModal('Connection error', `${msg}\n\nMake sure your backend server is running on port 4001 and PostgreSQL is connected.`, 'warning', '#EF4444')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  // Refresh reports
  const onRefresh = async () => {
    setRefreshing(true)
    await fetchReports()
    setRefreshing(false)
  }

  // Load reports on component mount
  React.useEffect(() => {
    if (user?.id) { fetchReports() }
  }, [fetchReports, user?.id])

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
  const handleLocationSelect = (location: { latitude: number; longitude: number; address?: string }) => {
    setSelectedLocation(location)
    setLocation(location.address || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`)
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
    return reports.filter(report => report.urgency_tag === filterMap[activeFilter])
  }

  // Handle filter change
  const handleFilterChange = (filter: 'All' | 'High' | 'Medium' | 'Low') => {
    setActiveFilter(filter)
  }

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
          Animated.timing(translateY, {
            toValue: screenHeight,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            setShowAdd(false)
            translateY.setValue(0)
            resetForm()
          })
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 2,
            speed: 22,
            useNativeDriver: true,
          }).start()
        }
      },
    })
  ).current

  const resetForm = () => {
    setIncidentType('')
    setShowIncidentMenu(false)
    setLocation('')
    setUrgency('')
    setDescription('')
    setMedia([])
    setIsSubmitting(false)
    setSelectedLocation(null)
  }

  const handleClose = () => {
    setShowAdd(false)
    resetForm()
  }

  const handleSave = async () => {
    if (!incidentType || !location || !urgency || !description) {
      showModal('Validation error', 'Please fill in all required fields', 'warning', '#EF4444')
      return
    }

    setIsSubmitting(true)

    try {
      const mediaUrls = media.map(m => m.uri)
      const reportData = {
        incidentType,
        location: selectedLocation ? `${selectedLocation.latitude},${selectedLocation.longitude}` : location,
        urgency,
        description,
        mediaUrls
      }
      const userId = user?.id || 1
      await api.reports.create(reportData, userId)
      await fetchReports()
      showModal('Report submitted', 'Your report has been submitted successfully.', 'checkmark-circle', '#16A34A')
      setShowAdd(false); resetForm()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to submit report'
      showModal('Submission error', msg, 'warning', '#EF4444')
    } finally {
      setIsSubmitting(false)
    }
  }

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    })
    if (!result.canceled) {
      const assets = result.assets?.map((a: any) => ({ uri: a.uri, type: a.type })) ?? []
      setMedia(prev => [...prev, ...assets])
    }
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

  // Render report item
  const renderReportItem = ({ item }: { item: any }) => {
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
                    <Text className={`text-sm font-medium text-gray-500 mr-2`}>#{item.id}</Text>
                    <Text className={`text-lg font-bold text-gray-900`}>{item.incident_type}</Text>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="location" size={14} color="#4B5563" />
                    <Text className={`text-sm ml-1 font-medium text-gray-600`}>{item.location}</Text>
                  </View>
                </View>
              </View>
              <View className="px-3 py-1.5 rounded-full shadow-sm" style={{ backgroundColor: getUrgencyColor(item.urgency_tag), shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }}>
                <Text className="text-xs font-bold tracking-wide text-white">{item.urgency_tag.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <View className="px-6 py-5">
            <Text className={`text-sm leading-6 mb-4 text-gray-700`} numberOfLines={2}>{item.description}</Text>
            <View className={`flex-row items-center justify-between pt-3 border-t border-gray-100`}>
              <View className="flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                <Text className={`text-xs font-medium text-gray-500`}>REPORTED</Text>
              </View>
              <Text className={`text-xs font-medium text-gray-400`}>{formatTimestamp(item.incident_datetime)}</Text>
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
        <View className={`bg-white px-8 py-8 border-b border-gray-100 shadow-sm`}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 self-center p-2 mt-4 flex-row items-center">
              <Image source={images.logo} style={{ width: 90, height: 90, resizeMode: 'contain', marginRight: 20 }} />
              <View>
                <Text className={`text-5xl font-bold text-blue-500 mb-2`}>Reports</Text>
                <Text className={`text-md font-medium text-gray-600`}>
                  {getFilteredReports().length} of {reports.length} {reports.length === 1 ? 'report' : 'reports'}
                  {activeFilter !== 'All' && ` (${activeFilter} priority)`}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Filter Buttons */}
        <View className={`bg-white px-6 py-5 border-b border-gray-100`}>
          <View className="flex-row gap-3">
            {(['All', 'High', 'Medium', 'Low'] as const).map((filter) => {
              const isActive = activeFilter === filter
              return (
                <TouchableOpacity
                  key={filter}
                  onPress={() => handleFilterChange(filter)}
                  className={`flex-1 px-4 py-3 rounded-full border ${
                    isActive 
                      ? (filter === 'High' ? 'bg-red-500 border-red-500' : 
                         filter === 'Medium' ? 'bg-yellow-500 border-yellow-500' : 
                         filter === 'Low' ? 'bg-green-500 border-green-500' : 
                         'bg-blue-500 border-blue-500')
                      : 'bg-transparent border-gray-300'
                  }`}
                  activeOpacity={0.8}
                >
                  <Text className={`text-sm font-bold text-center ${ isActive ? 'text-white' : 'text-gray-700' }`}>
                    {filter}
                  </Text>
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
            contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
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
            <View className={`bg-white p-10 rounded-3xl shadow-lg items-center mx-4`}>
              <View className="w-20 h-20 bg-blue-50 rounded-full items-center justify-center mb-6">
                <Ionicons name="document-outline" size={40} color="#4A90E2" />
              </View>
              <Text className={`text-xl font-bold mb-3 text-center text-gray-900`}>
                {reports.length === 0 ? 'No Reports Yet' : `No ${activeFilter} Reports`}
              </Text>
              <Text className={`text-center text-base leading-6 px-2 text-gray-500`}>
                {reports.length === 0 
                  ? 'Tap the + button below to create your first emergency report'
                  : `Try selecting a different filter or create a new report`}
              </Text>
            </View>
          </ScrollView>
        ) : (
          <View className={`flex-1 bg-gray-50`}>
            <FlatList
              data={getFilteredReports()}
              renderItem={renderReportItem}
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
              ItemSeparatorComponent={() => <View className="h-3" />}
            />
          </View>
        )}
      </View>

      {/* Speed dial call button */}
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

      {/* Add Report Modal */}
      <Modal visible={showAdd} animationType="slide" onRequestClose={handleClose}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.select({ ios: 'padding', android: undefined })}>
          <Animated.View style={{ transform: [{ translateY }] }} className={`flex-1 bg-white p-4`}>
            <View className="absolute top-0 left-0 right-0 h-12 z-50 items-center justify-start pt-4" {...panResponder.panHandlers}>
              <View className={`mt-2 w-12 h-1.5 rounded-full bg-gray-300`} />
            </View>
            <View className="pt-6 mt-6">
              <Text className={`text-3xl font-bold mb-2 text-black`}>New Report</Text>
            </View>
            <View className="pt-6" />
            <ScrollView className="flex-1" contentContainerClassName="pb-28" showsVerticalScrollIndicator={false} onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y }} scrollEventThrottle={16}>
              <Text className={`text-sm mb-1 text-gray-600`}>Incident type</Text>
              <View className="relative mb-3">
                <TouchableOpacity onPress={() => setShowIncidentMenu(v => !v)} className={`border rounded-xl px-3 py-3 border-gray-300 bg-white`}>
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
                <TouchableOpacity onPress={pickMedia} className={`self-start px-4 py-2 rounded-lg bg-gray-100`}>
                  <Text className={`font-semibold text-gray-800`}>Add photos/videos</Text>
                </TouchableOpacity>
              </View>

              <Text className={`text-sm mb-1 text-gray-600`}>Description</Text>
              <TextInput placeholder="Describe the incident..." value={description} onChangeText={setDescription} className={`border rounded-xl px-3 py-3 text-base h-40 border-gray-300 bg-white text-black`} placeholderTextColor="#8E8E93" multiline textAlignVertical="top" />
            </ScrollView>

            <View className="absolute bottom-0 left-0 right-0 p-4">
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={handleClose} className={`flex-1 h-12 rounded-xl items-center justify-center bg-gray-200`}>
                  <Text className={`font-semibold text-base text-gray-800`}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} disabled={isSubmitting} className={`flex-1 h-12 rounded-xl items-center justify-center ${isSubmitting ? 'bg-gray-400' : 'bg-[#4A90E2]'}`}>
                  <Text className="text-white font-semibold text-base">{isSubmitting ? 'Submitting...' : 'Submit'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
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
                    <Text className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{selectedReport.urgency_tag.toUpperCase()} PRIORITY</Text>
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

              <View className="mb-6">
                <Text className={`text-lg font-semibold mb-2 text-gray-900`}>Report Information</Text>
                <View className={`p-4 rounded-xl space-y-3 bg-gray-50`}>
                  <View className="flex-row justify-between">
                    <Text className={'text-gray-600'}>Report ID:</Text>
                    <Text className={`font-medium text-gray-900`}>#{selectedReport.id}</Text>
                  </View>
                  <View className="flex-row justify-between">
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
      <AppModal visible={modalVisible} onClose={() => setModalVisible(false)} icon={modalIcon} iconColor={modalIconColor} title={modalTitle} message={modalMessage} actions={[{ label: 'OK', onPress: () => setModalVisible(false), variant: 'primary' }]} />
    </SafeAreaView>
  )
}

export default Reports