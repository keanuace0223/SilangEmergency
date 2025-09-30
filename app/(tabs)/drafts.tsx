import { Text, View } from 'react-native'

const Drafts = () => {
  return (
    <View className={`flex-1 justify-center items-center bg-gray-50`}>
      <Text className={`text-2xl font-bold text-gray-900`}>
        Drafts
      </Text>
      <Text className={`text-lg mt-2 text-gray-600`}>
        Your saved draft reports
      </Text>
    </View>
  )
}

export default Drafts