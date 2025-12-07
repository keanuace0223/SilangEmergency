import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Dimensions, Modal, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView, WebViewMessageEvent } from 'react-native-webview'
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
  const webViewRef = useRef<WebView>(null)
  const userHasInteracted = useRef(false)
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [addressCache, setAddressCache] = useState<Map<string, string>>(new Map())
  const [modalVisible, setModalVisible] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalMessage, setModalMessage] = useState('')
  const [modalIcon, setModalIcon] = useState<'information-circle' | 'warning'>('information-circle')
  const [modalIconColor, setModalIconColor] = useState<string>('#2563EB')
  const [showTips, setShowTips] = useState(true)
  const [footerHeight, setFooterHeight] = useState(0)

  // Responsive sizing and layout
  const zoomButtonSize = isSmallScreen ? 40 : isTablet ? 48 : 44
  const zoomIconSize = isSmallScreen ? 18 : isTablet ? 24 : 20
  const spacing = isSmallScreen ? 12 : isTablet ? 24 : 20
  // Compact header/footer paddings while still respecting system insets
  const footerPaddingTop = isSmallScreen ? 4 : 6
  const footerPaddingBottom = (insets.bottom || 0) + 6
  // FAB offset: once we know the footer height, keep the FAB a few pixels above it.
  // Before layout, fall back to a reasonable offset based on screen size.
  const fabBottom = footerHeight
    ? footerHeight + 12
    : footerPaddingBottom + (isSmallScreen ? 80 : 72)

  const showModal = (title: string, message: string, icon: 'information-circle' | 'warning' = 'information-circle', color = '#2563EB') => {
    setModalTitle(title)
    setModalMessage(message)
    setModalIcon(icon)
    setModalIconColor(color)
    setModalVisible(true)
  }
  
  const getCurrentLocation = useCallback(async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        userHasInteracted.current = false
      } else if (userHasInteracted.current) {
        // If user has already interacted, don't auto-center on their location again
        return
      }

      let hasLastKnown = false

      // Try to get last known position first for instant feedback
      try {
        const lastKnown = await Location.getLastKnownPositionAsync()
        // Only apply this auto-update if the user has NOT already manually selected a point
        if (lastKnown && !userHasInteracted.current) {
          const quickPosition = { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude }
          setMarkerPosition(quickPosition)
          if (!initialLocation) {
            setSelectedLocation(quickPosition)
          }
          hasLastKnown = true
        }
      } catch {
        console.log('No cached location available')
      }

      // Only show the locating spinner if there was no last-known fix
      if (!hasLastKnown) {
        setIsLocating(true)
      }

      // Check permissions first
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setIsLocating(false)
        showModal('Permission denied', 'Location permission is required to use this feature', 'warning', '#EF4444')
        return
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

        // If user has already manually selected a location, do not override it with GPS
        if (userHasInteracted.current) {
          setIsLocating(false)
          return
        }

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
      } finally {
        setIsLocating(false)
      }
    } catch (error) {
      console.error('Error getting location:', error)
      setIsLocating(false)
      showModal('Location error', 'Unable to get your current location. Please select manually on the map.', 'warning', '#EF4444')
    }
  }, [initialLocation])

  // When the picker opens with an initial location (e.g., pre-fetched current GPS
  // from the parent screen), immediately sync the internal marker/selection so
  // the Confirm button is ready without waiting for a fresh GPS fix.
  useEffect(() => {
    if (!visible || !initialLocation) return
    if (userHasInteracted.current) return

    setMarkerPosition(initialLocation)
    setSelectedLocation(initialLocation)
  }, [visible, initialLocation])

  useEffect(() => {
    if (!visible) return
    // If the parent passed an initialLocation (e.g., already-fetched current
    // GPS), don't auto-fetch again here. The marker/selection are already set
    // by the effect above so the Confirm button is ready immediately.
    if (initialLocation) return

    // Only auto-fetch GPS when we don't have any starting point yet.
    getCurrentLocation(true)
  }, [visible, getCurrentLocation, initialLocation])

  // Auto-zoom/pan the map to the latest marker position without reloading the WebView
  useEffect(() => {
    try {
      if (!webViewRef.current) return
      const { latitude, longitude } = markerPosition
      const js = `try { if (typeof map !== 'undefined') { map.setView([${latitude}, ${longitude}], 16); if (typeof marker !== 'undefined' && marker) { marker.setLatLng([${latitude}, ${longitude}]); } else { marker = L.marker([${latitude}, ${longitude}]).addTo(map); } } } catch (e) {}`
      webViewRef.current.injectJavaScript(js)
    } catch {}
  }, [markerPosition])

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data)

      if (message?.event === 'onMapClicked') {
        userHasInteracted.current = true // User has manually selected a location
        const { lat, lng } = message.payload?.touchLatLng || {}
        if (lat && lng) {
          const newLocation = { latitude: lat, longitude: lng }
          setMarkerPosition(newLocation)
          setSelectedLocation(newLocation)
        }
      }
    } catch (error) {
      console.warn('Invalid message from WebView:', error)
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

  // Static HTML for the map: depends only on the initialLocation (or a default),
  // not on live React state like markerPosition or selectedLocation.
  // Uses a classic pin-style marker and hides default Leaflet zoom controls
  // so that React Native can provide custom floating controls.
  const mapHtml = useMemo(() => {
    const defaultLatitude = 14.5995
    const defaultLongitude = 120.9842
    const initialLat = initialLocation?.latitude ?? defaultLatitude
    const initialLng = initialLocation?.longitude ?? defaultLongitude

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Location Picker</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; width: 100%; }
      #map { height: 100%; width: 100%; }
      .leaflet-control-container { pointer-events: none; }
      .leaflet-control-container .leaflet-control { pointer-events: auto; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      const map = L.map('map', { zoomControl: false }).setView([${initialLat}, ${initialLng}], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      let marker = null;
      ${initialLocation ? `marker = L.marker([${initialLat}, ${initialLng}]).addTo(map);` : ''}

      map.on('click', function(e) {
        if (marker) {
          map.removeLayer(marker);
        }
        marker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
        const message = {
          event: 'onMapClicked',
          payload: { touchLatLng: { lat: e.latlng.lat, lng: e.latlng.lng } }
        };
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      });
    </script>
  </body>
</html>`
  }, [initialLocation])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View className="flex-1 bg-white">
        {/* Modern translucent header with title and close button */}
        <View 
          className="border-b border-transparent" 
          style={{ 
            paddingTop: 15,
            paddingBottom: 15,
            paddingHorizontal: spacing,
            backgroundColor: 'rgba(255,255,255,0.92)',
            elevation: 3,
          }}
        >
          <View className="flex-row items-center justify-between ">
            <TouchableOpacity 
              onPress={onClose} 
              className="items-center justify-center flex-shrink-0 "
              style={{
                width: isSmallScreen ? 36 : 40,
                height: isSmallScreen ? 36 : 40,
                borderRadius: isSmallScreen ? 18 : 20,
                backgroundColor: 'rgba(255,255,255,0.95)',
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Ionicons name="close" size={isSmallScreen ? 18 : 20} color="#111827" />
            </TouchableOpacity>
            
            <View className="flex-1 items-center mx-1">
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
            source={{ html: mapHtml }}
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

          {/* Floating controls overlay */}
          <View 
            className="absolute inset-0"
            style={{ 
              pointerEvents: 'box-none',
              zIndex: 9998 
            }}
          >

            {/* Zoom controls - floating glass card */}
            <View
              className="absolute overflow-hidden"
              style={{
                top: 20,
                left: 20, // Move to left side to avoid overlap
                borderRadius: isSmallScreen ? 10 : 12,
                backgroundColor: 'rgba(255,255,255,0.9)',
                borderWidth: 1,
                borderColor: 'rgba(148,163,184,0.35)',
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowOffset: { width: 0, height: 3 },
                shadowRadius: 6,
                elevation: 6,
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

            {/* Locating indicator - only when no last-known fix */}
            {isLocating && (
              <View
                className="absolute flex-row items-center justify-center px-3 py-2 bg-white"
                style={{
                  top: 20,
                  alignSelf: 'center',
                  borderRadius: 999,
                  shadowColor: '#000',
                  shadowOpacity: 0.12,
                  shadowOffset: { width: 0, height: 2 },
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
                <ActivityIndicator size="small" color="#2563EB" />
                <Text className="ml-2 text-gray-700" style={{ fontSize: isSmallScreen ? 11 : 13 }}>
                  Finding your location...
                </Text>
              </View>
            )}

          </View>
        </View>

        {/* Current Location Button - floating FAB in lower right, above footer & tips */}
        <TouchableOpacity
          onPress={() => getCurrentLocation(true)}
          activeOpacity={0.8}
          style={{
            position: 'absolute',
            bottom: fabBottom,
            right: 20,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#2563EB',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 10,
            zIndex: 2000,
          }}
        >
          <Ionicons name="locate" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Footer with Confirm button and tips - stacked at bottom over map */}
        <View 
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200"
          style={{ 
            paddingTop: footerPaddingTop,
            paddingHorizontal: spacing,
            paddingBottom: footerPaddingBottom,
          }}
          onLayout={event => {
            const { height } = event.nativeEvent.layout
            setFooterHeight(height)
          }}
        >
            {/* Confirm button */}
            <TouchableOpacity 
              onPress={handleConfirm} 
              disabled={isLoading || !selectedLocation}
              className="w-full items-center justify-center rounded-xl shadow-lg mb-2"
              style={{
                paddingVertical: isSmallScreen ? 12 : 14,
                backgroundColor: selectedLocation && !isLoading ? '#2563EB' : '#D1D5DB',
                borderRadius: 999,
                shadowColor: selectedLocation ? '#2563EB' : '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: selectedLocation ? 0.28 : 0.08,
                shadowRadius: 10,
                elevation: selectedLocation ? 8 : 2,
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
          {/* Quick Tips - subtle, dismissible card */}
          {showTips && (
            <View className="mt-1">
              <View
                className="flex-row items-start"
                style={{
                  backgroundColor: '#EEF2FF',
                  borderRadius: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  shadowColor: '#000',
                  shadowOpacity: 0.08,
                  shadowOffset: { width: 0, height: 2 },
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <View
                  className="items-center justify-center mt-0.5"
                  style={{ marginRight: 8 }}
                >
                  <Ionicons name="information-circle-outline" size={16} color="#2563EB" />
                </View>
                <View className="flex-1 mr-2">
                  <Text
                    className="text-blue-900 font-semibold mb-0.5"
                    style={{ fontSize: isSmallScreen ? 11 : 13 }}
                  >
                    Quick tips
                  </Text>
                  <Text
                    className="text-blue-900"
                    style={{ fontSize: isSmallScreen ? 10 : 12, lineHeight: isSmallScreen ? 13 : 15 }}
                  >
                    • Tap anywhere on the map to drop the pin.
                  </Text>
                  <Text
                    className="text-blue-900"
                    style={{ fontSize: isSmallScreen ? 10 : 12, lineHeight: isSmallScreen ? 13 : 15 }}
                  >
                    • Use the blue target button to jump to your current location.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowTips(false)}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  className="items-center justify-center mt-0.5"
                >
                  <Ionicons name="close" size={14} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
        {modalVisible && (
          <AppModal
            visible={true}
            onClose={() => setModalVisible(false)}
            icon={modalIcon}
            iconColor={modalIconColor}
            title={modalTitle}
            message={modalMessage}
            actions={[{ label: 'OK', variant: 'primary', onPress: () => setModalVisible(false) }]}
          />
        )}
      </View>
    </Modal>
  )
}

export default LocationPicker
