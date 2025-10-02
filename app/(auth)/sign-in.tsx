import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppModal from '../../components/AppModal';
import ScaledText from '../../components/ScaledText';
import { images } from '../../constants/images';
import { useUser } from '../../src/context/UserContext';
import { auth, db } from '../../src/lib/supabase';
import '../global.css';

export default function SignInScreen() {
  const router = useRouter();
  const { refreshUser } = useUser();
  const [userID, setUserID] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [focusedInput, setFocusedInput] = useState<'userID' | 'password' | null>(null);

  // Modals
  const [successVisible, setSuccessVisible] = useState(false);
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageTitle, setMessageTitle] = useState('');
  const [messageText, setMessageText] = useState('');
  const [messageIcon, setMessageIcon] = useState<'information-circle' | 'warning'>('information-circle');
  const [messageIconColor, setMessageIconColor] = useState('#2563EB');

  // Animation values - start visible
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start subtle entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Spinning animation for loading
  useEffect(() => {
    if (loading) {
      const spin = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      spin.start();
      return () => spin.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [loading, spinAnim]);

  const handleSignIn = async () => {
    setErrorMessage('');

    if (!userID.trim() || !password.trim()) {
      setErrorMessage('Please fill in all fields');
      setMessageTitle('Validation error');
      setMessageText('Please fill in all fields');
      setMessageIcon('warning');
      setMessageIconColor('#EF4444');
      setMessageVisible(true);
      return;
    }

    setLoading(true);
    try {
      console.log('Attempting login with:', { userID: userID.trim(), password: '***' });

      // 1) Create a real Supabase session via email alias so RLS works
      const { data: sessionData, error: aliasErr } = await auth.signInWithUseridAlias(userID.trim(), password.trim());
      if (aliasErr || !sessionData?.user) {
        const msg = 'Invalid credentials';
        setErrorMessage(msg);
        setMessageTitle('Sign in failed');
        setMessageText(msg);
        setMessageIcon('warning');
        setMessageIconColor('#EF4444');
        setMessageVisible(true);
        return;
      }

      // 2) Load or create profile using the authenticated user id
      const userId = sessionData.user.id;
      let { data: profile } = await db.getUser(userId);
      if (!profile) {
        const useridAlias = userID.trim();
        const fallbackName = useridAlias;
        const upsert = await db.upsertUser({ id: userId, userid: useridAlias, name: fallbackName, barangay: '', barangay_position: '' });
        profile = upsert.data || null;
      }
      if (!profile) {
        const msg = 'Failed to load user profile.';
        setErrorMessage(msg);
        setMessageTitle('Sign in error');
        setMessageText(msg);
        setMessageIcon('warning');
        setMessageIconColor('#EF4444');
        setMessageVisible(true);
        return;
      }

      // Persist minimal token surrogate and user data
      // 3) Persist token (optional for existing app flow)
      const accessToken = sessionData.session?.access_token || 'supabase-session';
      await AsyncStorage.setItem('authToken', accessToken);
      const persistedUser = {
        id: profile.id,
        userID: profile.userid,
        name: profile.name,
        barangay: profile.barangay,
        barangay_position: profile.barangay_position,
        profile_pic: profile.profile_pic || null,
      };
      await AsyncStorage.setItem('userData', JSON.stringify(persistedUser));
      try { await refreshUser(); } catch {}
      setSuccessVisible(true);

      // End of login flow
    } catch (error) {
      console.error('Login error details:', error);
      let msg = 'Network request failed. Please check your connection and try again.'
      if (error instanceof Error) {
        if (error.message.includes('Failed to persist auth token')) {
          msg = 'Error storing authentication data'
        } else if (!error.message.includes('Network request failed')) {
          msg = `Error: ${error.message}`
        }
      }
      setErrorMessage(msg);
      setMessageTitle('Sign in error');
      setMessageText(msg);
      setMessageIcon('warning');
      setMessageIconColor('#EF4444');
      setMessageVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top','bottom','left','right']}>
      <KeyboardAvoidingView 
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Status Bar Spacer */}
          <View className="h-8" />
          
          {/* Logo/Brand Section */}
          <View className="items-center px-8 pt-8 pb-12">
            <View className="flex-row gap-4 items-center mb-2">
              <Image 
                source={images.logo} 
                className="w-28 h-28 mb-3"
                style={{ width: 112, height: 112, resizeMode: 'contain' }}
              />
              <View>
                <ScaledText baseSize={28} className="text-gray-600 font-bold tracking-wider" style={{ marginBottom: -8 }}>Silang</ScaledText>
                <ScaledText baseSize={28} className="text-gray-600 font-bold tracking-wider">Emergency</ScaledText>
              </View>
            </View>

            <View>
            <ScaledText baseSize={13} className="text-gray-400 font-light tracking-wider">A report system for Silang Emergency Response</ScaledText>
            </View>
          </View>


          {/* Form Section */}
          <View className="flex-1 px-8 pb-8">
          {/* Error Message */}
          {errorMessage ? (
            <View className="bg-red-50 p-4 rounded-lg mb-6 border border-red-100">
              <View className="flex-row items-center">
                <Ionicons name="warning" size={16} color="#EF4444" style={{ marginRight: 8 }} />
                <ScaledText baseSize={13} className="text-red-600 font-medium flex-1">{errorMessage}</ScaledText>
              </View>
            </View>
          ) : null}

            {/* User ID Input */}
            <View className="mb-6">
              <ScaledText baseSize={13} className="text-gray-600 font-medium mb-3 tracking-wide uppercase">User ID</ScaledText>
              <View className="border-b-2 pb-3" style={{ borderBottomColor: focusedInput === 'userID' ? '#4A90E2' : '#E5E7EB', flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  value={userID}
                  onChangeText={setUserID}
                  onFocus={() => setFocusedInput('userID')}
                  onBlur={() => setFocusedInput(null)}
                  placeholder="Enter your user ID"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="text-gray-900 font-light flex-1"
                  style={{ fontSize: 18, fontWeight: '300', color: '#111827' }}
                />
                {userID.trim() && (
                  <Ionicons name="checkmark-circle" size={20} color="#4A90E2" />
                )}
              </View>
            </View>

            {/* Password Input */}
            <View className="mb-8">
              <ScaledText baseSize={13} className="text-gray-600 font-medium mb-3 tracking-wide uppercase">Password</ScaledText>
              <View className="border-b-2 pb-3" style={{ borderBottomColor: focusedInput === 'password' ? '#4A90E2' : '#E5E7EB', flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  placeholder="Enter your password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="text-gray-900 font-light flex-1"
                  style={{ fontSize: 18, fontWeight: '300', color: '#111827' }}
                />
                {password.trim() && (
                  <Ionicons name="checkmark-circle" size={20} color="#4A90E2" />
                )}
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ marginLeft: 8 }}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <View className="mb-6">
              <TouchableOpacity onPress={handleSignIn} disabled={loading} className="bg-[#4A90E2] rounded-lg py-4 items-center" style={{ shadowColor: '#4A90E2', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }}>
                {loading ? (
                  <View className="flex-row items-center">
                    <Animated.View style={{ transform: [{ rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
                      <Ionicons name="refresh" size={20} color="white" />
                    </Animated.View>
                    <ScaledText baseSize={18} className="text-white font-medium ml-3 tracking-wide">SIGNING IN...</ScaledText>
                  </View>
                ) : (
                  <ScaledText baseSize={18} className="text-white font-medium tracking-wide">SIGN IN</ScaledText>
                )}
              </TouchableOpacity>
            </View>

            {/* Forgot Password Link */}
            <TouchableOpacity className="items-center mb-8" onPress={() => { setMessageTitle('Forgot password'); setMessageText('Password reset functionality would be implemented here.'); setMessageIcon('information-circle'); setMessageIconColor('#2563EB'); setMessageVisible(true) }}>
              <ScaledText baseSize={13} className="text-gray-500 font-light tracking-wide">Forgot password?</ScaledText>
            </TouchableOpacity>

            {/* Footer */}
            <View className="items-center mb-8">
              <ScaledText baseSize={12} className="text-gray-400 font-light tracking-widest">© Silang Emergency System</ScaledText>
            </View>
          </View>
        </ScrollView>

      {/* Success Modal */}
      <AppModal visible={successVisible} onClose={() => { setSuccessVisible(false); router.replace('/(tabs)') }} icon="checkmark-circle" iconColor="#16A34A" title="Signed in" message="You have successfully signed in." actions={[{ label: 'Continue', onPress: () => { setSuccessVisible(false); router.replace('/(tabs)') }, variant: 'primary' }]} />

      {/* Message/Error Modal */}
      <AppModal visible={messageVisible} onClose={() => setMessageVisible(false)} icon={messageIcon} iconColor={messageIconColor} title={messageTitle} message={messageText || errorMessage || 'Please try again.'} actions={[{ label: 'OK', onPress: () => setMessageVisible(false), variant: 'secondary' }]} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}