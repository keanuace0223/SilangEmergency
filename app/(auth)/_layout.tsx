import CustomInputs from '@/components/CustomInputs';
import { images } from '@/constants/images';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import '../global.css';

export default function AuthLayout() {
  const router = useRouter();
  const [userID, setUserID] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!userID || !password) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      console.log('Attempting to login with:', { userID });
      console.log('Making request to server...');
      const response = await fetch('http://192.168.18.57:4001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ 
          userID,
          password 
        }),
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || 'Failed to sign in');
        } catch {
          throw new Error(errorText || 'Failed to sign in');
        }
      }

      const data = await response.json();
      console.log('Login successful:', data);
      
      // Store the token and user data
      try {
        await AsyncStorage.setItem('authToken', data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(data.user));

        // Verify token is persisted before navigating
        const savedToken = await AsyncStorage.getItem('authToken');
        if (!savedToken) {
          throw new Error('Failed to persist auth token');
        }

        // Navigate to main tabs after successful login
        router.replace('/(tabs)');
      } catch (storageError) {
        console.error('Error storing auth data:', storageError);
        alert('Error storing authentication data');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      alert(error.message || 'Network request failed. Please check your connection.');
    } finally {
      setLoading(false);
    }
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
                value={userID}
                onChangeText={setUserID}
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
                className={`bg-blue-600 py-3 rounded-md mt-6 ${loading ? 'opacity-70' : ''}`}
                onPress={handleSignIn}
                disabled={loading}
              >
                <Text className="text-white text-center font-semibold">
                  {loading ? 'Signing in...' : 'Sign In'}
                </Text>
              </TouchableOpacity>

              <Text className="flex-1 text-gray text-center font-semibold mt-20">Terms and Conditions</Text>
            </View>
          </ScrollView>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}