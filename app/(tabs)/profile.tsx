import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Modal, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useUser } from '../../src/context/UserContext'

const Profile = () => {
  const { user, logout, isLoading, refreshUser } = useUser()
  const router = useRouter()
  const [reportCount, setReportCount] = useState(0)
  const [isLoadingReports, setIsLoadingReports] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  
  // Animation for refresh icon
  const spinAnim = useRef(new Animated.Value(0)).current

  // Debug logging
  console.log('Profile component - user:', user, 'isLoading:', isLoading)

  const fetchReportCount = useCallback(async () => {
    if (!user?.id) return
    
    setIsLoadingReports(true)
    try {
      const response = await fetch(`http://192.168.18.57:4001/api/reports/count/${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setReportCount(data.count)
      }
    } catch (error) {
      console.error('Error fetching report count:', error)
    } finally {
      setIsLoadingReports(false)
    }
  }, [user?.id])

  // Refresh profile data
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      // Refresh user data
      await refreshUser()
      // Refresh report count
      await fetchReportCount()
    } catch (error) {
      console.error('Error refreshing profile:', error)
    } finally {
      setRefreshing(false)
    }
  }, [refreshUser, fetchReportCount])

  // Spinning animation for refresh icon
  useEffect(() => {
    if (refreshing || isLoadingReports) {
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
  }, [refreshing, isLoadingReports, spinAnim])

  useEffect(() => {
    // Refresh user data when component mounts
    refreshUser()
  }, [refreshUser])

  useEffect(() => {
    if (user?.id) {
      fetchReportCount()
    }
  }, [user?.id, fetchReportCount])

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
          <View className="w-28 h-28 bg-white rounded-full items-center justify-center mb-6 shadow-lg">
            <Ionicons name="person" size={48} color="#4A90E2" />
          </View>
          
          {/* User Info */}
          <Text className="text-white text-3xl font-bold mb-2">{user.name}</Text>
          <Text className="text-blue-100 text-lg mb-2 font-medium">{user.barangay_position}</Text>
          <Text className="text-blue-100 text-base">{user.barangay}</Text>
        </View>
      </View>

      {/* Stats Cards */}
      <View className="px-6 -mt-6 mb-6">
        <View className={`bg-white rounded-xl p-6 shadow-2xl elevation-8 items-center`}>
          <View className="flex-row items-center justify-center mb-2">
            <Text className={`text-gray-500 text-base font-medium`}>Reports Filed</Text>
            {(isLoadingReports || refreshing) && (
              <Animated.View
                style={{
                  transform: [{
                    rotate: spinAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    })
                  }]
                }}
                className="ml-2"
              >
                <Ionicons 
                  name="refresh" 
                  size={18} 
                  color={'#6B7280'} 
                />
              </Animated.View>
            )}
          </View>
          {isLoadingReports ? (
            <Text className={`text-4xl font-bold text-gray-900`}>...</Text>
          ) : (
            <Text className={`text-4xl font-bold text-gray-900`}>{reportCount}</Text>
          )}
        </View>
      </View>

      {/* Menu Options */}
      <View className="px-6 space-y-3">
        <View className={`bg-white rounded-xl p-3 shadow-sm`}>
          <TouchableOpacity className="flex-row items-center justify-between py-2">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center mr-3">
                <Ionicons name="person-outline" size={16} color="#4A90E2" />
              </View>
              <View>
                <Text className={`text-gray-900 font-medium text-sm`}>Personal Information</Text>
                <Text className={`text-gray-500 text-xs`}>Update your profile details</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View className={`bg-white rounded-xl p-3 shadow-sm`}>
          <TouchableOpacity onPress={showSettings} className="flex-row items-center justify-between py-2">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-green-100 rounded-full items-center justify-center mr-3">
                <Ionicons name="settings-outline" size={16} color="#10B981" />
              </View>
              <View>
                <Text className={`text-gray-900 font-medium text-sm`}>Settings</Text>
                <Text className={`text-gray-500 text-xs`}>App preferences and notifications</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View className={`bg-white rounded-xl p-3 shadow-sm`}>
          <TouchableOpacity className="flex-row items-center justify-between py-2">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-purple-100 rounded-full items-center justify-center mr-3">
                <Ionicons name="information-circle-outline" size={16} color="#8B5CF6" />
              </View>
              <View>
                <Text className={`text-gray-900 font-medium text-sm`}>About</Text>
                <Text className={`text-gray-500 text-xs`}>App version and legal information</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={showLogoutConfirmation} className={`bg-white rounded-xl p-3 shadow-sm mt-4 border border-gray-100`}>
          <View className="flex-row items-center justify-between py-2">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-red-500 rounded-full items-center justify-center mr-3 shadow-sm">
                <Ionicons name="log-out-outline" size={20} color="white" />
              </View>
              <View>
                <Text className={`text-gray-900 font-semibold text-base`}>Logout</Text>
                <Text className={`text-gray-500 text-xs`}>Sign out of your account</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
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
    </ScrollView>
  )
}

export default Profile