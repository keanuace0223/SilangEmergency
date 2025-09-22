import CustomInputs from '@/components/CustomInputs';
import { images } from '@/constants/images';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import '../global.css';

export default function _layout() {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <LinearGradient
        colors={['#4A90E2', '#007AFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <View className=' flex-1 h-full'>

          <ScrollView
            contentContainerClassName="h-full overflow-hidden"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className='w-50 h-[45%] justify-center align-center ' >
              <Image source={images.logo} className=' self-center'/>
              </View>

          <View className='h-full bg-white rounded-t-[30] p-10 align-center text-center'>
          
            <CustomInputs 
                placeholder='User ID'
                value={''}
                onChangeText={(text) => {}}
                label = 'User ID'
                keyboardType='default'
            />
            </View>
         
          </ScrollView>
        </View>

      </LinearGradient>


    </KeyboardAvoidingView>
  )
}