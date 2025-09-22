import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

const ReportDetails= () => {

    const {id} = useLocalSearchParams();
  return (
    <View>
      <Text>Report Details: {id} </Text>
    </View>
  )
}

export default ReportDetails