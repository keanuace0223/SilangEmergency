import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const AboutModal = () => {
  const router = useRouter()

  return (
    <SafeAreaView className="flex-1 bg-black/40" edges={['top', 'bottom', 'left', 'right']}>
      <View className="flex-1 justify-end">
        <View className="bg-white rounded-t-3xl px-6 pt-4 pb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold text-gray-900">About</Text>
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View className="mb-4">
            <Text className="text-gray-500 mb-1 text-sm">App Version</Text>
            <Text className="text-gray-900 font-semibold text-base">1.1.0</Text>
          </View>

          <View className="mt-2">
            <Text className="text-gray-600 text-sm leading-5">
              Silang Emergency helps barangay officials report and track emergency incidents quickly and
              consistently. Future updates will include more detailed app information and legal notices.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

export default AboutModal
