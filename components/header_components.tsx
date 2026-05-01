import { useAuth } from '@/context/auth_context'
import { Ionicons } from '@expo/vector-icons'
import React, { useState } from 'react'
import {
  Alert,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'

export default function HeaderBar()
{
  const { user, logout }          = useAuth()
  const [menuVisible, setMenuVisible] = useState(false)

  // Derive initials from email (e.g. "tc.pan@corppay.com" → "TC")
  const initials = user?.email
    ? user.email
        .split('@')[0]           // "tc.pan"
        .split(/[._-]/)          // ["tc", "pan"]
        .map(p => p[0])          // ["t", "p"]
        .slice(0, 2)
        .join('')
        .toUpperCase()           // "TP"
    : 'CP'

  // Display label: capitalise the part before the @ sign
  const displayName = user?.email
    ? user.email
        .split('@')[0]
        .split(/[._-]/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')               // "Tc Pan"
    : 'CorpPay'

  const roleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)   // "User" | "Admin"
    : ''

  function handleAvatarPress()
  {
    if (Platform.OS === 'web')
    {
      setMenuVisible(true)
    }
    else
    {
      Alert.alert(
        displayName,
        user?.email ?? '',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: logout },
        ]
      )
    }
  }

  return (
    <View className="flex-row items-center justify-between px-4 pt-14 pb-3 bg-white border-b border-[#F3F4F6]">
      
      <TouchableOpacity>
        <Ionicons name="menu-outline" size={26} color="#111" />
      </TouchableOpacity>

      <TouchableOpacity className="flex-row items-center gap-2" onPress={handleAvatarPress}>
        {/* Avatar — always initials-based since backend has no picture field */}
        <View className="w-9 h-9 rounded-full bg-[#3B82F6] justify-center items-center">
          <Text className="text-white text-sm font-bold">{initials}</Text>
        </View>

        <View>
          <Text className="text-sm font-semibold text-[#111]">{displayName}</Text>
          <Text className="text-xs text-[#888]">{roleLabel}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity className="relative">
        <Ionicons name="notifications-outline" size={26} color="#111" />
        <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EF4444] justify-center items-center">
          <Text className="text-white text-[9px] font-bold">3</Text>
        </View>
      </TouchableOpacity>

      {/* Web-only sign-out action sheet */}
      {Platform.OS === 'web' && (
        <Modal
          visible={menuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
            <View className="flex-1 bg-black/35 justify-center items-center">
              <View className="w-[390px] h-[844px] justify-end">
                <TouchableWithoutFeedback>
                  <View className="px-2 pb-[50px]">

                    <View className="bg-[rgba(242,242,247,0.97)] rounded-2xl mb-2 overflow-hidden">
                      <View className="py-[14px] px-4 items-center border-b border-[rgba(60,60,67,0.29)]">
                        <Text className="text-[13px] font-semibold text-[#3c3c43] tracking-[-0.08px]">
                          {displayName}
                        </Text>
                        <Text className="text-[13px] font-normal text-[rgba(60,60,67,0.6)] mt-0.5 tracking-[-0.08px]">
                          {user?.email ?? ''}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => { setMenuVisible(false); logout() }}
                        className="py-[18px] items-center"
                        activeOpacity={0.6}
                      >
                        <Text className="text-[20px] font-normal text-[#FF3B30] tracking-[-0.45px]">
                          Sign Out
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      onPress={() => setMenuVisible(false)}
                      activeOpacity={0.6}
                      className="bg-[rgba(242,242,247,0.97)] rounded-2xl py-[18px] items-center"
                    >
                      <Text className="text-[20px] font-semibold text-[#007AFF] tracking-[-0.45px]">
                        Cancel
                      </Text>
                    </TouchableOpacity>

                  </View>
                </TouchableWithoutFeedback>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </View>
  )
}