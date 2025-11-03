import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppModal from '../../components/AppModal';
import ScaledText from '../../components/ScaledText';
import { adminApi, type AdminUser } from '../../src/utils/adminApi';

export default function AdminUsersScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  // (Filters UI removed for now)
  const [addVisible, setAddVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formUserid, setFormUserid] = useState('');
  const [formName, setFormName] = useState('');
  const [formBarangay, setFormBarangay] = useState('');
  const [formPosition, setFormPosition] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirm, setFormConfirm] = useState('');
  const [formError, setFormError] = useState('');
  const [showPositionMenu, setShowPositionMenu] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmUser, setConfirmUser] = useState<AdminUser | null>(null);
  const [isResettingLimit, setIsResettingLimit] = useState(false);

  const adminUserIds = useMemo(() => ['admin1','admin2','admin3'], []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { users: rawUsers } = await adminApi.getUsers({ page: 1, limit: 50, search, includeReports: true });
      const filtered = (rawUsers || []).filter(u => !adminUserIds.includes(String(u.userid)));
      setUsers(filtered);
    } finally {
      setLoading(false);
    }
  }, [adminUserIds, search]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setFormUserid('');
    setFormName('');
    setFormBarangay('');
    setFormPosition('');
    setFormPassword('');
    setFormConfirm('');
    setFormError('');
    setShowPositionMenu(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleAddUser = async () => {
    setFormError('');
    if (!formUserid.trim() || !formName.trim() || !formBarangay.trim() || !formPosition.trim() || !formPassword) {
      setFormError('Please fill in all fields.');
      return;
    }
    if (formPassword !== formConfirm) {
      setFormError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
        return await Promise.race<T>([
          promise,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timed out. Please try again.')), ms)) as unknown as Promise<T>,
        ]);
      };

      await withTimeout(adminApi.createUser({
        userid: formUserid.trim(),
        name: formName.trim(),
        barangay: formBarangay.trim(),
        barangay_position: formPosition.trim(),
        password: formPassword,
      }), 15000);
      await load();
      setAddVisible(false);
      resetForm();
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : 'Failed to create user.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetLimit = async () => {
    if (!confirmUser) return;
    
    setIsResettingLimit(true);
    try {
      const result = await adminApi.resetUserReportLimit(confirmUser.id);
      
      if (result.success) {
        Alert.alert(
          'Success',
          `Report limit reset successfully. ${result.count} report${result.count !== 1 ? 's' : ''} moved outside the hourly window.`,
          [{ text: 'OK', onPress: () => setConfirmUser(null) }]
        );
      } else {
        Alert.alert('Error', 'Failed to reset report limit. Please try again.');
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message || 'Failed to reset report limit. Please try again.'
      );
    } finally {
      setIsResettingLimit(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top','bottom']}>
      <View className="bg-white px-6 py-4 border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <View style={{ flex: 1, paddingRight: 12 }}>
            <ScaledText baseSize={20} className="font-bold text-gray-900">Users</ScaledText>
            <Text className="text-gray-600">All non-admin users and their report counts</Text>
          </View>
          <TouchableOpacity onPress={() => setAddVisible(true)} className="px-3 py-2 rounded-lg bg-[#4A90E2] flex-row items-center">
            <Ionicons name="person-add" size={16} color="#fff" />
            <Text className="text-white font-semibold ml-2">Add User</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="bg-white px-6 py-3 border-b border-gray-100">
        <Text className="text-gray-700 mb-2">Search</Text>
        <TextInput value={search} onChangeText={setSearch} placeholder="Name or userid or barangay" className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900" onSubmitEditing={load} />
        <View className="flex-row gap-3 mt-3">
          <TouchableOpacity onPress={load} className="px-4 py-3 rounded-lg bg-[#4A90E2]"><Text className="text-white font-semibold">Apply</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => { setSearch(''); load(); }} className="px-4 py-3 rounded-lg bg-gray-100"><Text className="text-gray-800 font-semibold">Reset</Text></TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#4A90E2" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {users.length === 0 ? (
            <Text className="text-center text-gray-500">No users found.</Text>
          ) : (
            users.map((item) => (
              <View key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 mb-3" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 }}>
                <View className="flex-row items-center justify-between">
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <ScaledText baseSize={14} className="font-semibold text-gray-900">{item.name || 'Unnamed'}</ScaledText>
                    <Text className="text-xs text-gray-500" numberOfLines={1}>{item.userid} • {item.barangay || '—'}</Text>
                    {typeof (item as any).reportCount === 'number' ? (
                      <Text className="text-xs text-gray-500 mt-1">Reports: {(item as any).reportCount}</Text>
                    ) : null}
                  </View>
                  <View className="flex-row gap-2">
                    <TouchableOpacity onPress={() => setConfirmUser(item)} className="px-3 py-2 rounded-lg bg-gray-500 flex-row items-center">
                      <Ionicons name="refresh" size={16} color="#fff" />
                      <Text className="text-white font-semibold ml-2">Reset Limit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => router.push({ pathname: '/(admin)/user-reports', params: { userId: item.id } })} className="px-3 py-2 rounded-lg bg-[#4A90E2] flex-row items-center">
                      <Ionicons name="document-text" size={16} color="#fff" />
                      <Text className="text-white font-semibold ml-2">View Reports</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Reset Limit Confirmation Modal */}
      <AppModal
        visible={confirmUser !== null}
        onClose={() => !isResettingLimit && setConfirmUser(null)}
        icon="alert-circle"
        iconColor="#F59E0B"
        title="Reset Report Limit?"
        message={confirmUser ? `Are you sure you want to reset the hourly report limit for ${confirmUser.name}? This will allow them to submit 3 more reports immediately.` : ''}
        actions={[
          {
            label: 'Cancel',
            onPress: () => setConfirmUser(null),
            variant: 'secondary'
          },
          {
            label: isResettingLimit ? 'Resetting...' : 'Confirm',
            onPress: handleResetLimit,
            variant: 'primary',
            disabled: isResettingLimit
          }
        ]}
      />

      {/* Add User Modal */}
      <Modal visible={addVisible} animationType="slide" onRequestClose={() => { if (!submitting) { setAddVisible(false); resetForm(); } }}>
        <View className="flex-1 bg-white">
          <View className="px-6 py-4 border-b border-gray-100 flex-row items-center justify-between">
            <ScaledText baseSize={18} className="font-bold text-gray-900">Add User</ScaledText>
            <TouchableOpacity onPress={() => { if (!submitting) { setAddVisible(false); resetForm(); } }} className="px-3 py-2 rounded-lg bg-gray-100">
              <Text className="text-gray-800">Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {formError ? (
              <View className="bg-red-50 p-3 rounded-lg border border-red-100 mb-4">
                <Text className="text-red-600">{formError}</Text>
              </View>
            ) : null}
            <View className="mb-3">
              <Text className="text-gray-700 mb-1">User ID</Text>
              <TextInput value={formUserid} onChangeText={setFormUserid} placeholder="e.g. juandelacruz" className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900" autoCapitalize="none" />
            </View>
            <View className="mb-3">
              <Text className="text-gray-700 mb-1">Full Name</Text>
              <TextInput value={formName} onChangeText={setFormName} placeholder="e.g. Juan Dela Cruz" className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900" />
            </View>
            <View className="mb-3">
              <Text className="text-gray-700 mb-1">Barangay</Text>
              <TextInput value={formBarangay} onChangeText={setFormBarangay} placeholder="Barangay" className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900" />
            </View>
            <View className="mb-3">
              <Text className="text-gray-700 mb-1">Position</Text>
              <View className="relative">
                <TouchableOpacity
                  onPress={() => setShowPositionMenu(v => !v)}
                  className="border border-gray-300 rounded-lg px-4 py-3 bg-white flex-row items-center justify-between"
                  activeOpacity={0.8}
                >
                  <Text className={`text-gray-900 ${formPosition ? '' : 'text-gray-400'}`}>
                    {formPosition || 'Select position'}
                  </Text>
                  <Ionicons name={showPositionMenu ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
                </TouchableOpacity>
                {showPositionMenu && (
                  <View className="absolute left-0 right-0 top-14 rounded-xl overflow-hidden z-50 bg-white border border-gray-300">
                    {['Councilor','Barangay Captain'].map(opt => (
                      <TouchableOpacity
                        key={opt}
                        className="px-4 py-3 active:bg-gray-50"
                        onPress={() => { setFormPosition(opt); setShowPositionMenu(false); }}
                      >
                        <Text className="text-gray-900">{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
            <View className="mb-3">
              <Text className="text-gray-700 mb-1">Password</Text>
              <View className="border border-gray-300 rounded-lg flex-row items-center justify-between px-3 bg-white">
                <TextInput
                  value={formPassword}
                  onChangeText={setFormPassword}
                  placeholder="Password"
                  className="flex-1 py-3 text-gray-900"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>
            <View className="mb-3">
              <Text className="text-gray-700 mb-1">Confirm Password</Text>
              <View className="border border-gray-300 rounded-lg flex-row items-center justify-between px-3 bg-white">
                <TextInput
                  value={formConfirm}
                  onChangeText={setFormConfirm}
                  placeholder="Confirm Password"
                  className="flex-1 py-3 text-gray-900"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(v => !v)} style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
          <View className="px-4 py-4 border-t border-gray-100">
            <TouchableOpacity disabled={submitting} onPress={handleAddUser} className={`rounded-lg py-3 items-center ${submitting ? 'bg-gray-400' : 'bg-[#4A90E2]'}`}>
              {submitting ? (
                <Text className="text-white font-semibold">Creating...</Text>
              ) : (
                <Text className="text-white font-semibold">Create User</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}


