import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Animated, Dimensions, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import OptimizedProfilePicture from '../../components/OptimizedProfilePicture'
import { api } from '../../src/api/client'
import { useSettings } from '../../src/context/SettingsContext'
import { useUser } from '../../src/context/UserContext'
import { db, deleteAvatar, uploadProfileImage } from '../../src/lib/supabase'

const Profile = () => {
  const { user, logout, isLoading, refreshUser } = useUser()
  const { largeTextEnabled, textScale, toggleLargeText } = useSettings()
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [showPersonalModal, setShowPersonalModal] = useState(false)
  const [showDeleteAvatarConfirm, setShowDeleteAvatarConfirm] = useState(false)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)

  // Extract a Supabase Storage path from either a raw path or a signed/public URL
  const getStoragePathFromValue = useCallback((value: string | null | undefined): string | null => {
    if (!value || typeof value !== 'string') return null
    // Already a storage path like: <userId>/<filename>
    if (!value.startsWith('http')) return value
    // Try to extract after '/avatars/' or '/object/avatars/' or '/sign/avatars/'
    try {
      const url = new URL(value)
      const segments = url.pathname.split('/')
      const idx = segments.findIndex((s) => s === 'avatars')
      if (idx !== -1 && segments.length > idx + 1) {
        const path = segments.slice(idx + 1).join('/')
        return decodeURIComponent(path)
      }
    } catch {}
    return null
  }, [])
  // Ensure image is <= 500KB for faster loading (reduced from 1MB)
  const compressImageToUnder500KB = useCallback(async (uri: string): Promise<string> => {
    try {
      const ImageManipulator: any = await import('expo-image-manipulator')
      // Initial check
      let info = await FileSystem.getInfoAsync(uri, { size: true } as any)
      const targetSize = 500 * 1024 // 500KB for faster loading
      if ('size' in info && typeof (info as any).size === 'number' && (info as any).size <= targetSize) return uri

      // More aggressive initial parameters for profile pictures
      let targetWidth = 512 // Smaller initial size for profile pics
      let quality = 0.7 // Lower initial quality

      for (let i = 0; i < 5; i++) {
        const manip = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: targetWidth } }],
          { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
        )
        uri = manip.uri
        info = await FileSystem.getInfoAsync(uri, { size: true } as any)
        if ('size' in info && typeof (info as any).size === 'number' && (info as any).size <= targetSize) {
          return uri
        }
        // More aggressive compression
        targetWidth = Math.max(256, Math.floor(targetWidth * 0.75))
        quality = Math.max(0.3, quality - 0.1)
      }
      return uri
    } catch (e) {
      console.warn('Image compression failed, using original image', e)
      return uri
    }
  }, [])


  const [editName, setEditName] = useState('')
  const [editBarangay, setEditBarangay] = useState('')
  const [editContactNumber, setEditContactNumber] = useState('')
  const [editPosition, setEditPosition] = useState<'Barangay Captain' | 'Councilor' | ''>('')
  const [showPositionMenu, setShowPositionMenu] = useState(false)
  const [isSavingPersonal, setIsSavingPersonal] = useState(false)
  
  // Animation for refresh icon
  const spinAnim = useRef(new Animated.Value(0)).current

  // Profile component loaded


  // Refresh profile data
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      // Refresh user data
      await refreshUser()
    } catch (error) {
      console.error('Error refreshing profile:', error)
    } finally {
      setRefreshing(false)
    }
  }, [refreshUser])

  // Spinning animation for refresh icon
  useEffect(() => {
    if (refreshing) {
      const spin = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      )
      spin.start()
      return () => spin.stop()
    } else {
      spinAnim.setValue(0)
    }
  }, [refreshing, spinAnim])

  useEffect(() => {
    // Refresh user data when component mounts
    refreshUser()
  }, [refreshUser])


  // Ensure navigation is available when component is focused
  useFocusEffect(
    useCallback(() => {
      // This ensures the navigation context is available
      return () => {
        // Cleanup if needed
      }
    }, [])
  )

  const handleLogout = async () => {
    try {
      await logout()
      setShowLogoutModal(false)
      // Navigate to sign-in screen after successful logout
      router.replace('/(auth)/sign-in')
      // Logout successful, navigating to sign-in screen
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const showLogoutConfirmation = () => {
    setShowLogoutModal(true)
  }

  const cancelLogout = () => {
    setShowLogoutModal(false)
  }

  const showSettings = () => {
    setShowSettingsModal(true)
  }

  const closeSettings = () => {
    setShowSettingsModal(false)
  }

  const scaleFont = useCallback((size: number) => Math.round(size * textScale), [textScale])

  if (isLoading) {
    return (
      <View className={`flex-1 justify-center items-center bg-gray-50`}>
        <Text className={`text-gray-500`} style={{ fontSize: scaleFont(18) }}>Loading...</Text>
      </View>
    )
  }

  if (!user) {
    return (
      <View className={`flex-1 justify-center items-center bg-gray-50`}>
        <Text className={`text-gray-500`} style={{ fontSize: scaleFont(18) }}>Please log in to view your profile</Text>
      </View>
    )
  }

  return (
    <SafeAreaView className={`flex-1 bg-gray-50`} edges={['top','bottom','left','right']}>
    <ScrollView 
      className={`flex-1 bg-gray-50`}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={'#000000'}
          colors={['#4A90E2']}
        />
      }
    >
      {/* Header Section */}
      <View className={`bg-blue-500 pt-10 pb-10 px-4`}>
        <View className="items-center">
          {/* Profile Picture */}
          <View className="mb-6">
            <OptimizedProfilePicture
              uri={avatarPreviewUrl || user.profile_pic}
              size={112} // w-28 h-28 equivalent
              className=""
            />
            {/* Edit avatar button */}
            <TouchableOpacity
              onPress={async () => {
                try {
                  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
                  if (perm.status !== 'granted') return
                  const result = await ImagePicker.launchImageLibraryAsync({ 
                    mediaTypes: ImagePicker.MediaTypeOptions.Images, 
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.7, // Reduced quality for smaller file size
                    exif: false, // Remove EXIF data to reduce size
                    allowsMultipleSelection: false
                  })
                  if (!result.canceled && result.assets && result.assets.length > 0) {
                    let localUri = result.assets[0].uri
                    // Ensure <= 500KB for faster loading
                    localUri = await compressImageToUnder500KB(localUri)
                    if (user?.id) {
                      // Upload to Supabase Storage and save storage path to user row; use signed URL for preview
                      const { path, signedUrl, error } = await uploadProfileImage(String(user.id), localUri)
                      if (error || !path) {
                        console.warn('Avatar upload failed or path missing. Not updating DB.', error)
                        Alert.alert('Upload failed', (error as any)?.message || 'Could not upload image to storage.')
                        return
                      }
                      const finalUrl = signedUrl || localUri
                      setAvatarPreviewUrl(finalUrl)
                      try {
                        // Write storage path into DB; UI will resolve to signed URL when needed
                        const { data, error: updateErr } = await db.updateUser(String(user.id), { profile_pic: path } as any)
                        if (updateErr) {
                          console.warn('Supabase profile_pic update failed', updateErr)
                        }
                        // Mirror to local storage using server response when available
                        const nextPersist = data ? {
                          id: data.id,
                          userID: data.userid,
                          name: data.name,
                          barangay: data.barangay,
                          barangay_position: data.barangay_position,
                          contact_number: (data as any).contact_number,
                          profile_pic: data.profile_pic || path,
                        } : null
                        if (nextPersist) {
                          await AsyncStorage.setItem('userData', JSON.stringify(nextPersist))
                        }
                      } catch (e) { console.warn('Supabase profile_pic update failed', e) }
                      if (!__DEV__) {}
                      // Fallback: ensure at least local storage has the path
                      const raw = await AsyncStorage.getItem('userData')
                      const parsed = raw ? JSON.parse(raw) : {}
                      const updated = { ...parsed, profile_pic: path }
                      await AsyncStorage.setItem('userData', JSON.stringify(updated))
                      await refreshUser()
                      // Clear preview once global user is refreshed to avoid stale signed URL
                      setAvatarPreviewUrl(null)
                    }
                  }
                } catch (e) {
                  console.error('Profile photo update failed', e)
                }
              }}
              className="w-9 h-9 rounded-full bg-white items-center justify-center"
              style={{ position: 'absolute', bottom: -6, left: -6, elevation: 3 }}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil" size={16} color="#4A90E2" />
            </TouchableOpacity>

            {/* Remove avatar button (only show if profile pic exists) */}
            {user.profile_pic && (
              <TouchableOpacity
                onPress={() => setShowDeleteAvatarConfirm(true)}
                className="w-9 h-9 rounded-full bg-red-500 items-center justify-center"
                style={{ position: 'absolute', bottom: -6, right: -6, elevation: 3 }}
                activeOpacity={0.8}
              >
                <Ionicons name="trash" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            )}
      {/* Delete Avatar Confirmation Modal */}
      <Modal
        visible={showDeleteAvatarConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteAvatarConfirm(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl px-6 py-7 mx-6 w-80 shadow-2xl">
            <View className="items-center mb-5">
              <View className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-3">
                <Ionicons name="trash" size={32} color="#EF4444" />
              </View>
              <Text className="font-bold text-gray-900 mb-2" style={{ fontSize: 18 }}>Remove profile photo?</Text>
              <Text className="text-gray-600 text-center" style={{ fontSize: 14 }}>This will delete your current avatar from storage and clear it from your profile.</Text>
            </View>
            <View className="flex-row gap-4 mt-4">
              <TouchableOpacity onPress={() => setShowDeleteAvatarConfirm(false)} className="flex-1 bg-gray-100 rounded-xl py-3 items-center">
                <Text className="text-gray-700" style={{ fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    if (!user?.id) return
                    // If local storage has a path, attempt to delete the file in storage
                    const raw = await AsyncStorage.getItem('userData')
                    const parsed = raw ? JSON.parse(raw) : {}
                    const storagePath = getStoragePathFromValue(parsed?.profile_pic)
                    if (storagePath) {
                      try {
                        const { error } = await deleteAvatar(storagePath)
                        if (error) {
                          console.warn('Delete avatar from storage failed', error)
                          Alert.alert('Delete failed', 'Could not delete file from storage. It may be a permissions issue.')
                        }
                      } catch (e) {
                        console.warn('Delete avatar from storage threw', e)
                      }
                    } else {
                      console.warn('No valid storage path found for profile_pic; skipping storage delete')
                    }
                    await db.updateUser(String(user.id), { profile_pic: null } as any)
                    const updated = { ...parsed, profile_pic: null }
                    await AsyncStorage.setItem('userData', JSON.stringify(updated))
                    await refreshUser()
                    setAvatarPreviewUrl(null)
                  } catch (e) {
                    console.error('Profile photo removal failed', e)
                  } finally {
                    setShowDeleteAvatarConfirm(false)
                  }
                }}
                className="flex-1 bg-red-500 rounded-xl py-3 items-center"
              >
                <Text className="text-white" style={{ fontSize: 16 }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
          </View>
          
          {/* User Info */}
          <View className="flex-1 items-center justify-center">
          <Text className="text-white font-bold mb-2" style={{ fontSize: scaleFont(30) }}>{user.name}</Text>
          <Text className="text-gray-200 mb-1 font-medium" style={{ fontSize: scaleFont(20) }}>{user.barangay_position}</Text>
          <View className="flex-row items-center justify-center">
            <Ionicons name="location" size={18} color="#E5E7EB" />
            <Text className="text-gray-100 ml-2" style={{ fontSize: scaleFont(18) }}>{user.barangay}</Text>
          </View>
          </View>
        </View>
      </View>

      {/* Removed Reports Filed card per request */}

      {/* Menu Options */}
      <View className="px-6 space-y-4">
        <View className={`bg-white rounded-xl p-4 shadow-sm`}>
          <TouchableOpacity onPress={() => {
            if (!user) return
            setEditName(user.name || '')
            setEditBarangay(user.barangay || '')
            setEditContactNumber((user as any).contact_number || '')
            setEditPosition((user.barangay_position as any) === 'Barangay Captain' || (user.barangay_position as any) === 'Councilor' ? user.barangay_position as any : '')
            setShowPersonalModal(true)
          }} className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-4">
                <Ionicons name="person-outline" size={18} color="#4A90E2" />
              </View>
              <View>
                <Text className={`text-gray-900 font-medium`} style={{ fontSize: scaleFont(16) }}>Personal Information</Text>
                <Text className={`text-gray-500`} style={{ fontSize: scaleFont(13) }}>Update your profile details</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View className={`bg-white rounded-xl p-4 shadow-sm`}>
          <TouchableOpacity onPress={showSettings} className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mr-4">
                <Ionicons name="settings-outline" size={18} color="#10B981" />
              </View>
              <View>
                <Text className={`text-gray-900 font-medium`} style={{ fontSize: scaleFont(16) }}>Settings</Text>
                <Text className={`text-gray-500`} style={{ fontSize: scaleFont(13) }}>App preferences and notifications</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View className={`bg-white rounded-xl p-4 shadow-sm`}>
          <TouchableOpacity onPress={() => setShowAboutModal(true)} className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center mr-4">
                <Ionicons name="information-circle-outline" size={18} color="#8B5CF6" />
              </View>
              <View>
                <Text className={`text-gray-900 font-medium`} style={{ fontSize: scaleFont(16) }}>About</Text>
                <Text className={`text-gray-500`} style={{ fontSize: scaleFont(13) }}>App version and legal information</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={showLogoutConfirmation} className={`bg-white rounded-xl p-4 shadow-sm mt-4 border border-gray-100`}>
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <View className="w-12 h-12 bg-red-500 rounded-full items-center justify-center mr-4 shadow-sm">
                <Ionicons name="log-out-outline" size={22} color="white" />
              </View>
              <View>
                <Text className={`text-gray-900 font-semibold`} style={{ fontSize: scaleFont(18) }}>Logout</Text>
                <Text className={`text-gray-500`} style={{ fontSize: scaleFont(13) }}>Sign out of your account</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Bottom Spacing */}
      <View className="h-8" />

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelLogout}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl px-6 py-7 mx-6 w-80 shadow-2xl">
            {/* Modal Header */}
            <View className="items-center mb-5">
              <View className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-3">
                <Ionicons name="log-out-outline" size={32} color="#EF4444" />
              </View>
              <Text className="font-bold text-gray-900 mb-2 px-1" style={{ fontSize: scaleFont(20) }}>Logout</Text>
              <Text className="text-gray-600 text-center px-1" style={{ fontSize: scaleFont(14) }}>
                Are you sure you want to logout? You will need to sign in again to access your account.
              </Text>
            </View>

            {/* Modal Buttons */}
            <View className="flex-row gap-4 mt-4 px-1">
              <TouchableOpacity onPress={cancelLogout} className="flex-1 bg-gray-100 rounded-xl py-4 items-center">
                <Text className="text-gray-700 font-medium" style={{ fontSize: scaleFont(16) }}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleLogout} className="flex-1 bg-red-500 rounded-xl py-4 items-center">
                <Text className="text-white font-medium" style={{ fontSize: scaleFont(16) }}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeSettings}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 max-h-96">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between mb-6">
              <Text className="font-bold text-gray-900" style={{ fontSize: scaleFont(22) }}>Settings</Text>
              <TouchableOpacity onPress={closeSettings} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Larger Text Toggle */}
            <View className="flex-row items-center justify-between py-4">
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mr-4">
                  <Ionicons name="text" size={20} color="#10B981" />
                </View>
                <View>
                  <Text className="text-gray-900 font-medium" style={{ fontSize: scaleFont(18) }}>Larger Text</Text>
                  <Text className="text-gray-500" style={{ fontSize: scaleFont(13) }}>{largeTextEnabled ? 'On' : 'Off'} · Improve readability</Text>
                </View>
              </View>
              <TouchableOpacity onPress={toggleLargeText} className="px-3 py-2 rounded-full" activeOpacity={0.8} style={{ backgroundColor: largeTextEnabled ? '#DCFCE7' : '#F3F4F6' }}>
                <Text style={{ color: largeTextEnabled ? '#059669' : '#374151', fontWeight: '700', fontSize: scaleFont(13) }}>{largeTextEnabled ? 'ON' : 'OFF'}</Text>
              </TouchableOpacity>
            </View>

            {/* Additional Settings Placeholder */}
            <TouchableOpacity onPress={() => Alert.alert('Coming Soon')} className="flex-row items-center justify-between py-4">
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-4">
                  <Ionicons name="notifications-outline" size={20} color="#4A90E2" />
                </View>
                <View>
                  <Text className="text-gray-900 font-medium" style={{ fontSize: scaleFont(18) }}>Notifications</Text>
                  <Text className="text-gray-500" style={{ fontSize: scaleFont(13) }}>Manage notification preferences</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => Alert.alert('Coming Soon')} className="flex-row items-center justify-between py-4">
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center mr-4">
                  <Ionicons name="shield-outline" size={20} color="#8B5CF6" />
                </View>
                <View>
                  <Text className="text-gray-900 font-medium" style={{ fontSize: scaleFont(18) }}>Privacy</Text>
                  <Text className="text-gray-500" style={{ fontSize: scaleFont(13) }}>Privacy and security settings</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* About Modal */}
      <Modal
        visible={showAboutModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAboutModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="font-bold text-gray-900" style={{ fontSize: scaleFont(22) }}>About</Text>
              <TouchableOpacity onPress={() => setShowAboutModal(false)} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="text-gray-500 mb-1" style={{ fontSize: scaleFont(13) }}>App Version</Text>
              <Text className="text-gray-900 font-semibold" style={{ fontSize: scaleFont(16) }}>1.1.0</Text>
            </View>

            <Text className="text-gray-600" style={{ fontSize: scaleFont(14) }}>
              Silang Emergency helps barangay officials report and track emergency incidents quickly and
              consistently. Future updates will include more detailed app information and legal notices.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Personal Information Modal */}
      <Modal
        visible={showPersonalModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPersonalModal(false)}
      >
        <View className="flex-1 bg-black/50">
          <KeyboardAvoidingView 
            className="flex-1" 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <View className="flex-1 justify-end">
              <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: Dimensions.get('window').height * 0.85, minHeight: Dimensions.get('window').height * 0.6 }}>
                <View className="flex-row items-center justify-between mb-6">
                  <Text className="font-bold text-gray-900" style={{ fontSize: scaleFont(22) }}>Personal Information</Text>
                  <TouchableOpacity onPress={() => setShowPersonalModal(false)} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                    <Ionicons name="close" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <ScrollView 
                  className="flex-1" 
                  showsVerticalScrollIndicator={false} 
                  contentContainerStyle={{ paddingBottom: 24 }} 
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                >
                  <Text className="mb-1 text-gray-600" style={{ fontSize: scaleFont(13) }}>Full Name</Text>
                  <TextInput 
                    value={editName} 
                    onChangeText={setEditName} 
                    placeholder="Enter your name" 
                    className="border rounded-xl px-4 py-4 mb-4 border-gray-300 bg-white text-black" 
                    placeholderTextColor="#8E8E93" 
                    style={{ fontSize: scaleFont(16) }} 
                  />

                  <Text className="mb-1 text-gray-600" style={{ fontSize: scaleFont(13) }}>Mobile Number</Text>
                  <TextInput 
                    value={editContactNumber} 
                    onChangeText={setEditContactNumber} 
                    placeholder="e.g. 0912 345 6789" 
                    keyboardType="phone-pad"
                    className="border rounded-xl px-4 py-4 mb-4 border-gray-300 bg-white text-black" 
                    placeholderTextColor="#8E8E93" 
                    style={{ fontSize: scaleFont(16) }} 
                  />

                  <Text className="mb-1 text-gray-600" style={{ fontSize: scaleFont(13) }}>Barangay</Text>
                  <TextInput 
                    value={editBarangay} 
                    editable={false} 
                    className="border rounded-xl px-4 py-4 mb-4 border-gray-200 bg-gray-50 text-black" 
                    style={{ fontSize: scaleFont(16) }} 
                  />

                  <Text className="mb-1 text-gray-600" style={{ fontSize: scaleFont(13) }}>Position</Text>
                  <View className="relative mb-6" style={{ zIndex: 2 }}>
                    <TouchableOpacity onPress={() => setShowPositionMenu(v => !v)} className="border rounded-xl px-4 py-4 border-gray-300 bg-white">
                      <View className="flex-row items-center justify-between">
                        <Text className={`${editPosition ? 'text-black' : 'text-gray-400'}`} style={{ fontSize: scaleFont(16) }}>{editPosition || 'Select position'}</Text>
                        <Ionicons name={showPositionMenu ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
                      </View>
                    </TouchableOpacity>
                    {showPositionMenu && (
                      <View className="absolute left-0 right-0 top-16 rounded-xl overflow-hidden bg-white border border-gray-300" style={{ elevation: 10, zIndex: 1000 }}>
                        {(['Barangay Captain','Councilor'] as const).map(pos => (
                          <TouchableOpacity key={pos} className="px-4 py-4 flex-row items-center active:bg-gray-50" onPress={() => { setEditPosition(pos); setShowPositionMenu(false) }}>
                            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                            <Text className="ml-3 text-black" style={{ fontSize: scaleFont(16) }}>{pos}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </ScrollView>

                <View className="flex-row gap-3 pt-4 border-t border-gray-100">
                  <TouchableOpacity onPress={() => setShowPersonalModal(false)} className="flex-1 h-12 rounded-xl items-center justify-center bg-gray-200">
                    <Text className="text-gray-800 font-semibold" style={{ fontSize: scaleFont(16) }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={isSavingPersonal}
                    onPress={async () => {
                      if (!user) return
                      setIsSavingPersonal(true)
                      try {
                        // Persist to backend first
                        const updatedServer = await api.users.update(user.id, {
                          name: editName,
                          barangay_position: editPosition || undefined,
                          contact_number: editContactNumber.trim() || undefined,
                        })
                        // Mirror to local storage to keep context in sync
                        await AsyncStorage.setItem('userData', JSON.stringify(updatedServer))
                        await refreshUser()
                        setShowPersonalModal(false)
                      } catch (e) {
                        console.error('Save personal info failed', e)
                      } finally {
                        setIsSavingPersonal(false)
                      }
                    }}
                    className={`flex-1 h-12 rounded-xl items-center justify-center ${isSavingPersonal ? 'bg-gray-400' : 'bg-[#4A90E2]'}`}
                  >
                    <Text className="text-white font-semibold" style={{ fontSize: scaleFont(16) }}>{isSavingPersonal ? 'Saving...' : 'Save'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScrollView>
    </SafeAreaView>
  )
}

export default Profile