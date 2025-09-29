import React from 'react'
import { Text, View } from 'react-native'

const index = () => {
  return (
    <View className={`flex-1 justify-center items-center bg-gray-50`}>
      <Text className={`text-2xl font-bold text-gray-900`}>
        Welcome to Silang Emergency
      </Text>
      <Text className={`text-lg mt-2 text-gray-600`}>
        Emergency reporting system
      </Text>
    </View>
  )
}

export default index