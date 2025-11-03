import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { Modal, TouchableOpacity, View } from 'react-native'
import ScaledText from './ScaledText'

interface Action {
  label: string
  onPress?: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}

interface AppModalProps {
  visible: boolean
  onClose: () => void
  icon?: keyof typeof Ionicons.glyphMap
  iconColor?: string
  title: string
  message: string
  actions?: Action[]
}

const AppModal: React.FC<AppModalProps> = ({ visible, onClose, icon = 'information-circle', iconColor = '#2563EB', title, message, actions = [{ label: 'OK', onPress: onClose, variant: 'primary' }] }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-md rounded-2xl bg-white p-6">
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: '#EFF6FF' }}>
              <Ionicons name={icon} size={28} color={iconColor} />
            </View>
            <ScaledText baseSize={20} className="font-bold text-gray-900 mb-1">{title}</ScaledText>
            <ScaledText baseSize={14} className="text-gray-600 text-center">{message}</ScaledText>
          </View>
          <View className="flex-row gap-3 mt-2">
            {actions.map((a, idx) => (
              <TouchableOpacity 
                key={idx} 
                onPress={a.disabled ? undefined : (a.onPress || onClose)} 
                disabled={a.disabled}
                className={`flex-1 rounded-xl py-3 items-center ${
                  a.disabled 
                    ? 'bg-gray-400' 
                    : a.variant === 'danger' 
                    ? 'bg-red-500' 
                    : a.variant === 'secondary' 
                    ? 'bg-gray-100' 
                    : 'bg-[#4A90E2]'
                }`}
              >
                <ScaledText baseSize={16} className={`${a.variant === 'secondary' && !a.disabled ? 'text-gray-800' : 'text-white'} font-medium`}>{a.label}</ScaledText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default AppModal
