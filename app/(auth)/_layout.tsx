import CustomInputs from '@/components/CustomInputs';
import { images } from '@/constants/images';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import '../global.css';

export default function AuthLayout() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async () => {
    // We'll implement this next
    console.log('Signing in with:', userId);
  };

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
        <View className="flex-1 align-cen">
          <ScrollView
            contentContainerClassName="flex-1"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="h-[40%] justify-center align-center">
              <Image source={images.logo} className="self-center" />
            </View>

            <View className="flex-1 bg-white rounded-t-[30px] p-8 pt-20">
              <Text className="text-2xl font-bold mb-6 text-center">Sign In</Text>
              
              <CustomInputs 
                placeholder="User ID"
                value={userId}
                onChangeText={setUserId}
                label="User ID"
                keyboardType="default"
              />

              <CustomInputs 
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                label="Password"
                secureTextEntry
              />

              <TouchableOpacity
                className="bg-blue-600 py-3 rounded-md mt-6"
                onPress={handleSignIn}
              >
                <Text className="text-white text-center font-semibold">Sign In</Text>
              </TouchableOpacity>

              <Text className="flex-1 text-gray text-center font-semibold mt-20">Terms and Conditions</Text>
            </View>
          </ScrollView>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}