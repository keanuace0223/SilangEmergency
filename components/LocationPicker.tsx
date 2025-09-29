import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native'
import { WebView } from 'react-native-webview'
import AppModal from './AppModal'

interface LocationPickerProps {
  visible: boolean
  onClose: () => void
  onLocationSelect: (location: { latitude: number; longitude: number; address?: string }) => void
  initialLocation?: { latitude: number; longitude: number }
}

const LocationPicker: React.FC<LocationPickerProps> = ({ visible, onClose, onLocationSelect, initialLocation }) => {
  const [markerPosition, setMarkerPosition] = useState({ latitude: 14.5995, longitude: 120.9842 })
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [addressCache, setAddressCache] = useState<Map<string, string>>(new Map())
  const [modalVisible, setModalVisible] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalMessage, setModalMessage] = useState('')
  const [modalIcon, setModalIcon] = useState<'information-circle' | 'warning'>('information-circle')
  const [modalIconColor, setModalIconColor] = useState<string>('#2563EB')

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
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        showModal('Permission denied', 'Location permission is required to use this feature', 'warning', '#EF4444')
        return
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const newPosition = { latitude: location.coords.latitude, longitude: location.coords.longitude }
      setMarkerPosition(newPosition)
      if (initialLocation) {
        setSelectedLocation(initialLocation)
        setMarkerPosition(initialLocation)
      } else {
        setSelectedLocation(newPosition)
      }
    } catch (error) {
      console.error('Error getting location:', error)
      showModal('Location error', 'Unable to get your current location. Please select manually on the map.', 'warning', '#EF4444')
    } finally {
      setIsGettingLocation(false)
    }
  }, [initialLocation])

  useEffect(() => { if (visible) { getCurrentLocation() } }, [visible, getCurrentLocation])

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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="bg-white px-4 py-4 border-b border-gray-100 shadow-sm">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text className="text-lg font-semibold text-gray-900">Select Location</Text>
            <TouchableOpacity onPress={handleConfirm} className="p-2" disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#4A90E2" />
              ) : (
                <Text className="text-blue-600 font-semibold">Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-1">
          <WebView
            source={{ html: `<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>Location Picker</title><link rel=\"stylesheet\" href=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.css\" /><script src=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.js\"></script><style>body{margin:0;padding:0}#map{height:100vh;width:100%}</style></head><body><div id=\"map\"></div><script>const map=L.map('map').setView([${markerPosition.latitude},${markerPosition.longitude}],15);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(map);let marker=null;${selectedLocation ? `marker=L.marker([${selectedLocation.latitude},${selectedLocation.longitude}]).addTo(map);marker.bindPopup('Selected Location').openPopup();` : ''}map.on('click',function(e){if(marker){map.removeLayer(marker);}marker=L.marker([e.latlng.lat,e.latlng.lng]).addTo(map);marker.bindPopup('Selected Location').openPopup();const message={event:'onMapClicked',payload:{touchLatLng:{lat:e.latlng.lat,lng:e.latlng.lng}}};window.ReactNativeWebView.postMessage(JSON.stringify(message));});</script></body></html>` }}
            onMessage={handleMessage}
            style={{ flex: 1 }}
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
        </View>

        <View className="bg-blue-50 px-4 py-3 border-t border-blue-100">
          <View className="flex-row items-center">
            {isGettingLocation ? (
              <ActivityIndicator size="small" color="#4A90E2" />
            ) : (
              <Ionicons name="information-circle" size={20} color="#4A90E2" />
            )}
            <Text className="text-blue-800 ml-2 text-sm">{isGettingLocation ? 'Getting your current location...' : 'Tap on the map to select the incident location'}</Text>
          </View>
        </View>
      </View>

      <AppModal visible={modalVisible} onClose={() => setModalVisible(false)} icon={modalIcon} iconColor={modalIconColor} title={modalTitle} message={modalMessage} actions={[{ label: 'OK', variant: 'primary', onPress: () => setModalVisible(false) }]} />
    </Modal>
  )
}

export default LocationPicker
