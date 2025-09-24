import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import React from 'react'
import { Animated, Dimensions, Image, KeyboardAvoidingView, Modal, PanResponder, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'

const Reports = () => {
  const [showAdd, setShowAdd] = React.useState(false)
  const [incidentType, setIncidentType] = React.useState<'Fire' | 'Vehicular Accident' | 'Flood' | 'Earthquake' | 'Electrical' | ''>('')
  const [showIncidentMenu, setShowIncidentMenu] = React.useState(false)
  const [location, setLocation] = React.useState('')
  const [urgency, setUrgency] = React.useState<'Low' | 'Moderate' | 'High' | ''>('')
  const [description, setDescription] = React.useState('')
  const [media, setMedia] = React.useState<{ uri: string; type?: string }[]>([])
  const translateY = React.useRef(new Animated.Value(0)).current

  const screenHeight = Dimensions.get('window').height

  const scrollYRef = React.useRef(0)

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
  }

  const handleClose = () => {
    setShowAdd(false)
    resetForm()
  }

  const handleSave = () => {
    // TODO: connect to backend
    setShowAdd(false)
    resetForm()
  }

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      return
    }
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

  return (
    <View className="flex-1">
      <View className="flex-1 items-center justify-center">
        <Text className="text-lg font-semibold">Reports</Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setShowAdd(true)}
        className="absolute right-6 bottom-40 z-50 w-14 h-14 rounded-full bg-[#4A90E2] items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={showAdd}
        animationType="slide"
        onRequestClose={handleClose}
      >
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.select({ ios: 'padding', android: undefined })}
        >
          <Animated.View
            style={{ transform: [{ translateY }] }}
            className="flex-1 bg-white p-4 "
          >
            <View className="absolute top-0 left-0 right-0 h-12 z-50 items-center justify-start pt-4" {...panResponder.panHandlers}>
              <View className="mt-2 w-12 h-1.5 bg-gray-300 rounded-full" />
            </View>
            
            <View className="pt-6 mt-6">
            <Text className="text-3xl font-bold mb-2">New Report</Text>
            </View>
            <View className="pt-6" />
            <ScrollView
              className="flex-1"
              contentContainerClassName="pb-28"
              showsVerticalScrollIndicator={false}
              onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y }}
              scrollEventThrottle={16}
            >
              <Text className="text-sm text-gray-600 mb-1">Incident type</Text>
              <View className="relative mb-3">
                <TouchableOpacity
                  onPress={() => setShowIncidentMenu(v => !v)}
                  className="border border-gray-300 rounded-xl px-3 py-3"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base text-black">
                      {incidentType || 'Select incident type'}
                    </Text>
                    <Ionicons name={showIncidentMenu ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
                  </View>
                </TouchableOpacity>
                {showIncidentMenu && (
                  <View className="absolute left-0 right-0 top-14 bg-white border border-gray-300 rounded-xl overflow-hidden z-50">
                    {['Fire','Vehicular Accident','Flood','Earthquake','Electrical'].map(opt => (
                      <TouchableOpacity
                        key={opt}
                        className="px-3 py-3 active:bg-gray-50"
                        onPress={() => { setIncidentType(opt as any); setShowIncidentMenu(false) }}
                      >
                        <Text className="text-base text-black">{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <Text className="text-sm text-gray-600 mb-1">Location</Text>
              <TextInput
                placeholder="Enter location"
                value={location}
                onChangeText={setLocation}
                className="border border-gray-300 rounded-xl px-3 py-3 text-base text-black mb-3"
                placeholderTextColor="#8E8E93"
              />

              <Text className="text-sm text-gray-600 mb-1">Urgency</Text>
              <View className="flex-row gap-2 mb-3">
                {(['Low','Moderate','High'] as const).map(level => (
                  <TouchableOpacity
                    key={level}
                    onPress={() => setUrgency(level)}
                    className={`px-4 py-2 rounded-full border ${urgency === level ? 'bg-[#4A90E2] border-[#4A90E2]' : 'border-gray-300'} `}
                  >
                    <Text className={`${urgency === level ? 'text-white' : 'text-gray-700'} font-semibold`}>
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-sm text-gray-600 mb-1">Uploaded Media</Text>
              <View className="mb-2">
                <View className="flex-row flex-wrap gap-2 mb-2">
                  {media.map((m, idx) => (
                    <View key={`${m.uri}-${idx}`} className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                      <Image source={{ uri: m.uri }} className="w-full h-full" resizeMode="cover" />
                    </View>
                  ))}
                </View>
                <TouchableOpacity onPress={pickMedia} className="self-start px-4 py-2 rounded-lg bg-gray-100">
                  <Text className="text-gray-800 font-semibold">Add photos/videos</Text>
                </TouchableOpacity>
              </View>

              <Text className="text-sm text-gray-600 mb-1">Description</Text>
              <TextInput
                placeholder="Describe the incident..."
                value={description}
                onChangeText={setDescription}
                className="border border-gray-300 rounded-xl px-3 py-3 text-base text-black h-40"
                placeholderTextColor="#8E8E93"
                multiline
                textAlignVertical="top"
              />

            </ScrollView>

            <View className="absolute bottom-0 left-0 right-0 p-4">
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={handleClose} className="flex-1 h-12 rounded-xl bg-gray-200 items-center justify-center">
                  <Text className="text-gray-800 font-semibold text-base">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} className="flex-1 h-12 rounded-xl bg-[#4A90E2] items-center justify-center">
                  <Text className="text-white font-semibold text-base">Submit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

export default Reports