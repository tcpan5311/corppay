import { MaterialCommunityIcons } from '@expo/vector-icons'
import { usePathname, useRouter } from 'expo-router'
import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'

const FooterBar: React.FC = () => {
  const router = useRouter()
  const pathname = usePathname()

  const tabs = [
    { name: 'Home',      icon: 'home',       route: '/'        },
    { name: 'Wallet',    icon: 'wallet',     route: '/wallet'  },
    { name: 'Payroll',   icon: 'cash',       route: ''         },
    { name: 'Analytics', icon: 'chart-line', route: ''         },
    { name: 'Settings',  icon: 'cog',        route: ''         },
  ]

  return (
    <View className="flex-row justify-around items-center h-[70px] bg-white border-t border-[#ddd]">
      {tabs.map(tab => {
        const isActive = tab.route !== '' && pathname === tab.route
        return (
          <TouchableOpacity
            key={tab.name}
            className="justify-center items-center"
            onPress={() => tab.route && router.push(tab.route)}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={24}
              color={isActive ? '#2B4EFF' : tab.route ? '#333' : '#aaa'}
            />
            <Text
              className={`text-xs mt-0.5`}
              style={{ color: isActive ? '#2B4EFF' : tab.route ? '#333' : '#aaa' }}
            >
              {tab.name}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

export default FooterBar