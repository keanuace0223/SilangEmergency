import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, Image, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '../../src/api/client'
import { useUser } from '../../src/context/UserContext'

const Profile = () => {
  const { user, logout, isLoading, refreshUser } = useUser()
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showPersonalModal, setShowPersonalModal] = useState(false)

  const [editName, setEditName] = useState('')
  const [editBarangay, setEditBarangay] = useState('')
  const [editPosition, setEditPosition] = useState<'Barangay Captain' | 'Councilor' | ''>('')
  const [showPositionMenu, setShowPositionMenu] = useState(false)
  const [isSavingPersonal, setIsSavingPersonal] = useState(false)
  
  // Animation for refresh icon
  const spinAnim = useRef(new Animated.Value(0)).current

  // Debug logging
  console.log('Profile component - user:', user, 'isLoading:', isLoading)


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
      console.log('Logout successful, navigating to sign-in screen')
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

  if (isLoading) {
    return (
      <View className={`flex-1 justify-center items-center bg-gray-50`}>
        <Text className={`text-gray-500 text-lg`}>Loading...</Text>
      </View>
    )
  }

  if (!user) {
    return (
      <View className={`flex-1 justify-center items-center bg-gray-50`}>
        <Text className={`text-gray-500 text-lg`}>Please log in to view your profile</Text>
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
      <View className={`bg-blue-500 pt-16 pb-12 px-6`}>
        <View className="items-center">
          {/* Profile Picture */}
          <View className="mb-6">
            <View className="w-28 h-28 rounded-full overflow-hidden bg-white shadow-lg">
              {user.profile_pic ? (
                <Image source={{ uri: user.profile_pic }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Ionicons name="person" size={48} color="#4A90E2" />
                </View>
              )}
            </View>
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
                    quality: 0.9,
                    allowsMultipleSelection: false
                  })
                  if (!result.canceled && result.assets && result.assets.length > 0) {
                    const uri = result.assets[0].uri
                    // Persist to backend
                    if (user?.id) {
                      try { await api.users.update(user.id, { profile_pic: uri }) } catch {}
                    }
                    // Mirror to local storage for immediate UI
                    const raw = await AsyncStorage.getItem('userData')
                    const parsed = raw ? JSON.parse(raw) : {}
                    const updated = { ...parsed, profile_pic: uri }
                    await AsyncStorage.setItem('userData', JSON.stringify(updated))
                    await refreshUser()
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
                onPress={async () => {
                  try {
                    // Remove from backend
                    if (user?.id) {
                      try { await api.users.update(user.id, { profile_pic: null }) } catch {}
                    }
                    // Remove from local storage
                    const raw = await AsyncStorage.getItem('userData')
                    const parsed = raw ? JSON.parse(raw) : {}
                    const updated = { ...parsed, profile_pic: null }
                    await AsyncStorage.setItem('userData', JSON.stringify(updated))
                    await refreshUser()
                  } catch (e) {
                    console.error('Profile photo removal failed', e)
                  }
                }}
                className="w-9 h-9 rounded-full bg-red-500 items-center justify-center"
                style={{ position: 'absolute', bottom: -6, right: -6, elevation: 3 }}
                activeOpacity={0.8}
              >
                <Ionicons name="trash" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
          
          {/* User Info */}
          <Text className="text-white text-3xl font-bold mb-2">{user.name}</Text>
          <Text className="text-blue-100 text-lg mb-2 font-medium">{user.barangay_position}</Text>
          <Text className="text-blue-100 text-base">{user.barangay}</Text>
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
            setEditPosition((user.barangay_position as any) === 'Barangay Captain' || (user.barangay_position as any) === 'Councilor' ? user.barangay_position as any : '')
            setShowPersonalModal(true)
          }} className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-4">
                <Ionicons name="person-outline" size={18} color="#4A90E2" />
              </View>
              <View>
                <Text className={`text-gray-900 font-medium text-base`}>Personal Information</Text>
                <Text className={`text-gray-500 text-sm`}>Update your profile details</Text>
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
                <Text className={`text-gray-900 font-medium text-base`}>Settings</Text>
                <Text className={`text-gray-500 text-sm`}>App preferences and notifications</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View className={`bg-white rounded-xl p-4 shadow-sm`}>
          <TouchableOpacity className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center mr-4">
                <Ionicons name="information-circle-outline" size={18} color="#8B5CF6" />
              </View>
              <View>
                <Text className={`text-gray-900 font-medium text-base`}>About</Text>
                <Text className={`text-gray-500 text-sm`}>App version and legal information</Text>
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
                <Text className={`text-gray-900 font-semibold text-lg`}>Logout</Text>
                <Text className={`text-gray-500 text-sm`}>Sign out of your account</Text>
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
              <Text className="text-xl font-bold text-gray-900 mb-2 px-1">Logout</Text>
              <Text className="text-gray-600 text-center px-1">
                Are you sure you want to logout? You will need to sign in again to access your account.
              </Text>
            </View>

            {/* Modal Buttons */}
            <View className="flex-row gap-4 mt-4 px-1">
              <TouchableOpacity onPress={cancelLogout} className="flex-1 bg-gray-100 rounded-xl py-4 items-center">
                <Text className="text-gray-700 font-medium text-base">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleLogout} className="flex-1 bg-red-500 rounded-xl py-4 items-center">
                <Text className="text-white font-medium text-base">Logout</Text>
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
              <Text className="text-2xl font-bold text-gray-900">Settings</Text>
              <TouchableOpacity onPress={closeSettings} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Additional Settings Placeholder */}
            <View className="flex-row items-center justify-between py-4">
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-4">
                  <Ionicons name="notifications-outline" size={20} color="#4A90E2" />
                </View>
                <View>
                  <Text className="text-gray-900 font-medium text-lg">Notifications</Text>
                  <Text className="text-gray-500 text-sm">Manage notification preferences</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </View>

            <View className="flex-row items-center justify-between py-4">
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center mr-4">
                  <Ionicons name="shield-outline" size={20} color="#8B5CF6" />
                </View>
                <View>
                  <Text className="text-gray-900 font-medium text-lg">Privacy</Text>
                  <Text className="text-gray-500 text-sm">Privacy and security settings</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </View>
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
        <View className="flex-1 justify-end bg-black/50">
          <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} className="w-full">
          <View className="bg-white rounded-t-3xl p-6" style={{ height: Dimensions.get('window').height * 0.8 }}>
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-2xl font-bold text-gray-900">Personal Information</Text>
              <TouchableOpacity onPress={() => setShowPersonalModal(false)} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              <Text className="text-sm mb-1 text-gray-600">Full Name</Text>
              <TextInput value={editName} onChangeText={setEditName} placeholder="Enter your name" className="border rounded-xl px-3 py-3 text-base mb-3 border-gray-300 bg-white text-black" placeholderTextColor="#8E8E93" />

              <Text className="text-sm mb-1 text-gray-600">Barangay</Text>
              <TextInput value={editBarangay} editable={false} className="border rounded-xl px-3 py-3 text-base mb-3 border-gray-200 bg-gray-50 text-black" />

              <Text className="text-sm mb-1 text-gray-600">Position</Text>
              <View className="relative mb-3" style={{ zIndex: 2 }}>
                <TouchableOpacity onPress={() => setShowPositionMenu(v => !v)} className="border rounded-xl px-3 py-3 border-gray-300 bg-white">
                  <View className="flex-row items-center justify-between">
                    <Text className={`text-base ${editPosition ? 'text-black' : 'text-gray-400'}`}>{editPosition || 'Select position'}</Text>
                    <Ionicons name={showPositionMenu ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
                  </View>
                </TouchableOpacity>
                {showPositionMenu && (
                  <View className="absolute left-0 right-0 top-14 rounded-xl overflow-hidden bg-white border border-gray-300" style={{ elevation: 10 }}>
                    {(['Barangay Captain','Councilor'] as const).map(pos => (
                      <TouchableOpacity key={pos} className="px-3 py-3 flex-row items-center active:bg-gray-50" onPress={() => { setEditPosition(pos); setShowPositionMenu(false) }}>
                        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                        <Text className="text-base ml-3 text-black">{pos}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>

            <View className="mt-4 flex-row gap-3">
              <TouchableOpacity onPress={() => setShowPersonalModal(false)} className="flex-1 h-12 rounded-xl items-center justify-center bg-gray-200">
                <Text className="text-gray-800 font-semibold">Cancel</Text>
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
                <Text className="text-white font-semibold text-base">{isSavingPersonal ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
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