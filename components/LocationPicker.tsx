import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Dimensions, Modal, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import AppModal from './AppModal'

interface LocationPickerProps {
  visible: boolean
  onClose: () => void
  onLocationSelect: (location: { latitude: number; longitude: number; address?: string }) => void
  initialLocation?: { latitude: number; longitude: number }
}

const LocationPicker: React.FC<LocationPickerProps> = ({ visible, onClose, onLocationSelect, initialLocation }) => {
  const insets = useSafeAreaInsets()
  const { width } = Dimensions.get('window')
  const isSmallScreen = width < 375
  const isTablet = width > 768
  
  const [markerPosition, setMarkerPosition] = useState({ latitude: 14.5995, longitude: 120.9842 })
  const webViewRef = React.useRef<WebView>(null)
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [addressCache, setAddressCache] = useState<Map<string, string>>(new Map())
  const [modalVisible, setModalVisible] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalMessage, setModalMessage] = useState('')
  const [modalIcon, setModalIcon] = useState<'information-circle' | 'warning'>('information-circle')
  const [modalIconColor, setModalIconColor] = useState<string>('#2563EB')

  // Responsive sizing
  const zoomButtonSize = isSmallScreen ? 40 : isTablet ? 48 : 44
  const zoomIconSize = isSmallScreen ? 18 : isTablet ? 24 : 20
  const spacing = isSmallScreen ? 12 : isTablet ? 24 : 20

  const showModal = (title: string, message: string, icon: 'information-circle' | 'warning' = 'information-circle', color = '#2563EB') => {
    setModalTitle(title)
    setModalMessage(message)
    setModalIcon(icon)
    setModalIconColor(color)
    setModalVisible(true)
  }
  
  const getCurrentLocation = React.useCallback(async () => {
    try {
      setIsGettingLocation(true)
      
      // Check permissions first
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        showModal('Permission denied', 'Location permission is required to use this feature', 'warning', '#EF4444')
        return
      }

      // Try to get last known position first for instant feedback
      try {
        const lastKnown = await Location.getLastKnownPositionAsync()
        if (lastKnown) {
          const quickPosition = { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude }
          setMarkerPosition(quickPosition)
          if (!initialLocation) {
            setSelectedLocation(quickPosition)
          }
        }
      } catch {
        console.log('No cached location available')
      }

      // Get current location with timeout for faster response
      const locationPromise = Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 0,
      })
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Location timeout')), 10000)
      )

      try {
        const location = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject
        const newPosition = { latitude: location.coords.latitude, longitude: location.coords.longitude }
        setMarkerPosition(newPosition)
        if (initialLocation) {
          setSelectedLocation(initialLocation)
          setMarkerPosition(initialLocation)
        } else {
          setSelectedLocation(newPosition)
        }
      } catch {
        // If timeout, keep the last known position if we have it
        console.log('Location fetch timed out, using cached position')
      }
    } catch (error) {
      console.error('Error getting location:', error)
      showModal('Location error', 'Unable to get your current location. Please select manually on the map.', 'warning', '#EF4444')
    } finally {
      setIsGettingLocation(false)
    }
  }, [initialLocation])

  useEffect(() => { if (visible) { getCurrentLocation() } }, [visible, getCurrentLocation])

  // Auto-zoom/pan the map to the latest marker position
  useEffect(() => {
    try {
      if (!webViewRef.current) return
      const { latitude, longitude } = markerPosition
      const js = `try { if (typeof map !== 'undefined') { map.setView([${latitude}, ${longitude}], 16); if (typeof marker !== 'undefined' && marker) { marker.setLatLng([${latitude}, ${longitude}]); } else { marker = L.marker([${latitude}, ${longitude}]).addTo(map); } } } catch (e) {}`
      webViewRef.current.injectJavaScript(js)
    } catch {}
  }, [markerPosition])

  const handleMessage = useCallback((message: any) => {
    if (message?.event === 'onMapClicked') {
      const { lat, lng } = message.payload?.touchLatLng || {}
      if (lat && lng) {
        const newLocation = { latitude: lat, longitude: lng }
        setMarkerPosition(newLocation)
        setSelectedLocation(newLocation)
      }
    }
  }, [])

  const getAddressFromCache = useCallback((lat: number, lng: number) => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
    return addressCache.get(key)
  }, [addressCache])

  const setAddressInCache = useCallback((lat: number, lng: number, address: string) => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
    setAddressCache(prev => new Map(prev).set(key, address))
  }, [])

  const handleConfirm = async () => {
    if (!selectedLocation) {
      showModal('No location selected', 'Please tap on the map to select a location', 'warning', '#EF4444')
      return
    }

    try {
      setIsLoading(true)
      const cachedAddress = getAddressFromCache(selectedLocation.latitude, selectedLocation.longitude)
      if (cachedAddress) {
        onLocationSelect({ ...selectedLocation, address: cachedAddress })
        onClose()
        return
      }
      const address = await Location.reverseGeocodeAsync(selectedLocation)
      const addressString = address[0] ? `${address[0].street || ''} ${address[0].city || ''} ${address[0].region || ''}`.trim() : 'Selected Location'
      setAddressInCache(selectedLocation.latitude, selectedLocation.longitude, addressString)
      onLocationSelect({ ...selectedLocation, address: addressString })
      onClose()
    } catch (error) {
      console.error('Error getting address:', error)
      onLocationSelect(selectedLocation)
      onClose()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View className="flex-1 bg-white">
        {/* Simple header with title and close button */}
        <View 
          className="bg-white border-b border-gray-200 shadow-sm" 
          style={{ 
            paddingTop: insets.top,
            paddingHorizontal: spacing,
            paddingBottom: 18,
          }}
        >
          <View className="flex-row items-center justify-between">
            <TouchableOpacity 
              onPress={onClose} 
              className="bg-gray-100 items-center justify-center flex-shrink-0"
              style={{
                width: isSmallScreen ? 36 : 40,
                height: isSmallScreen ? 36 : 40,
                borderRadius: isSmallScreen ? 18 : 20
              }}
            >
              <Ionicons name="close" size={isSmallScreen ? 18 : 20} color="#6B7280" />
            </TouchableOpacity>
            
            <View className="flex-1 items-center mx-3">
              <Text 
                className="font-bold text-gray-900"
                style={{ fontSize: isSmallScreen ? 16 : isTablet ? 24 : 20 }}
                numberOfLines={1}
              >
                Select Location
              </Text>
            </View>
            
            <View style={{ width: isSmallScreen ? 36 : 40 }} />
          </View>
        </View>

        <View className="flex-1 relative">
          <WebView
            ref={webViewRef}
            source={{ html: `<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>Location Picker</title><link rel=\"stylesheet\" href=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.css\" /><script src=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.js\"></script><style>body{margin:0;padding:0}#map{height:100vh;width:100%}.leaflet-control-container{pointer-events:none}.leaflet-control-container .leaflet-control{pointer-events:auto}</style></head><body><div id=\"map\"></div><script>const map=L.map('map').setView([${markerPosition.latitude},${markerPosition.longitude}],15);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(map);let marker=null;${selectedLocation ? `marker=L.marker([${selectedLocation.latitude},${selectedLocation.longitude}]).addTo(map);marker.bindPopup('Selected Location').openPopup();` : ''}map.on('click',function(e){if(marker){map.removeLayer(marker);}marker=L.marker([e.latlng.lat,e.latlng.lng]).addTo(map);marker.bindPopup('Selected Location').openPopup();const message={event:'onMapClicked',payload:{touchLatLng:{lat:e.latlng.lat,lng:e.latlng.lng}}};window.ReactNativeWebView.postMessage(JSON.stringify(message));});</script></body></html>` }}
            onMessage={handleMessage}
            className="flex-1"
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#4A90E2" />
                <Text className="text-gray-600 mt-2">Loading map...</Text>
              </View>
            )}
          />
          
          {/* Current Location Button - Bottom Right of Map */}
          <TouchableOpacity
            onPress={getCurrentLocation}
            disabled={isGettingLocation}
            style={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: isGettingLocation ? '#93C5FD' : '#2563EB',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 20,
              zIndex: 1000,
            }}
            activeOpacity={0.8}
          >
            {isGettingLocation ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="locate" size={24} color="#fff" />
            )}
          </TouchableOpacity>
          
          {/* Floating controls overlay */}
          <View 
            className="absolute inset-0"
            style={{ 
              pointerEvents: 'box-none',
              zIndex: 9998 
            }}
          >

            {/* Zoom controls */}
            <View
              className="absolute bg-white shadow-lg overflow-hidden"
              style={{
                top: 20,
                left: 20, // Move to left side to avoid overlap
                borderRadius: isSmallScreen ? 6 : 8,
                elevation: 8
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  webViewRef.current?.injectJavaScript('map.zoomIn();')
                }}
                className="items-center justify-center border-b border-gray-200"
                style={{
                  width: zoomButtonSize,
                  height: zoomButtonSize
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={zoomIconSize} color="#374151" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  webViewRef.current?.injectJavaScript('map.zoomOut();')
                }}
                className="items-center justify-center"
                style={{
                  width: zoomButtonSize,
                  height: zoomButtonSize
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={zoomIconSize} color="#374151" />
              </TouchableOpacity>
            </View>

          </View>
        </View>

        {/* Footer with Confirm button and tips - absolutely positioned over map */}
        <View 
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200"
          style={{ 
            paddingTop: 16,
            paddingHorizontal: spacing,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          {/* Confirm button */}
          <TouchableOpacity 
            onPress={handleConfirm} 
            disabled={isLoading || !selectedLocation}
            className="w-full items-center justify-center rounded-xl shadow-lg mb-3"
            style={{
              paddingVertical: isSmallScreen ? 14 : 16,
              backgroundColor: selectedLocation && !isLoading ? '#2563EB' : '#D1D5DB',
              shadowColor: selectedLocation ? '#2563EB' : '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: selectedLocation ? 0.3 : 0.1,
              shadowRadius: 8,
              elevation: selectedLocation ? 8 : 2
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text 
                className="font-bold text-lg"
                style={{ 
                  color: selectedLocation ? '#FFFFFF' : '#9CA3AF',
                }}
              >
                Confirm Location
              </Text>
            )}
          </TouchableOpacity>

          {/* Quick Tips */}
          <View className="flex-row items-start">
            <View 
              className="bg-blue-100 items-center justify-center mt-0.5"
              style={{
                width: isSmallScreen ? 18 : 20,
                height: isSmallScreen ? 18 : 20,
                borderRadius: isSmallScreen ? 9 : 10,
                marginRight: isSmallScreen ? 6 : 8
              }}
            >
              <Ionicons name="bulb" size={isSmallScreen ? 9 : 10} color="#2563EB" />
            </View>
            <View className="flex-1">
              <Text 
                className="text-blue-900 font-medium mb-0.5"
                style={{ fontSize: isSmallScreen ? 11 : 13 }}
              >
                Quick Tips:
              </Text>
              <View className="flex-col gap-0.5">
                <Text 
                  className="text-blue-800"
                  style={{ 
                    fontSize: isSmallScreen ? 9 : 11,
                    lineHeight: isSmallScreen ? 12 : 14
                  }}
                >
                  • Tap anywhere on the map to select a location
                </Text>
                <Text 
                  className="text-blue-800"
                  style={{ 
                    fontSize: isSmallScreen ? 9 : 11,
                    lineHeight: isSmallScreen ? 12 : 14
                  }}
                >
                  • Use the 📍 button to get your current position
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {modalVisible && (
        <AppModal visible={true} onClose={() => setModalVisible(false)} icon={modalIcon} iconColor={modalIconColor} title={modalTitle} message={modalMessage} actions={[{ label: 'OK', variant: 'primary', onPress: () => setModalVisible(false) }]} />
      )}
    </Modal>
  )
}

export default LocationPicker
