import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'

function BalanceCard() {
  return (
    <View className="bg-[#1A2340] rounded-[20px] p-6 mx-4 mt-4">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-white/60 text-sm">Total Balance</Text>
        <Ionicons name="eye-outline" size={22} color="rgba(255,255,255,0.6)" />
      </View>

      <Text className="text-white text-[40px] font-bold mb-6">$1,248,520</Text>

      <View className="flex-row justify-between gap-3">
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.label}
            className="flex-1 bg-white/10 rounded-2xl py-3 items-center gap-1.5"
          >
            <View className="w-9 h-9 rounded-full bg-white/10 justify-center items-center">
              <Ionicons name={action.icon as any} size={18} color="#fff" />
            </View>
            <Text className="text-white text-xs font-medium">{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const quickActions = [
  { label: 'Add', icon: 'add-outline' },
  { label: 'Send', icon: 'paper-plane-outline' },
  { label: 'Request', icon: 'download-outline' },
  { label: 'More', icon: 'arrow-up-outline' },
]

const accounts = [
  {
    label: 'Main Operating Account',
    subLabel: 'Checking • ****4521',
    icon: 'business-outline',
    iconBg: 'bg-[#3B82F6]',
    balance: '$824,500',
  },
  {
    label: 'Payroll Account',
    subLabel: 'Checking • ****7892',
    icon: 'wallet-outline',
    iconBg: 'bg-[#22C55E]',
    balance: '$324,020',
  },
  {
    label: 'Reserve Fund',
    subLabel: 'Savings • ****3341',
    icon: 'card-outline',
    iconBg: 'bg-[#A855F7]',
    balance: '$100,000',
  },
]

const recentActivity = [
  {
    label: 'Transfer to Payroll',
    subLabel: 'Main → Payroll',
    date: 'Today, 2:30 PM',
    amount: '$50,000',
    isCredit: false,
    icon: 'arrow-up-outline',
    iconBg: 'bg-[#F3F4F6]',
    iconColor: '#555',
  },
  {
    label: 'Client Payment',
    subLabel: 'ABC Corp',
    date: 'Today, 10:15 AM',
    amount: '+$75,000',
    isCredit: true,
    icon: 'arrow-down-outline',
    iconBg: 'bg-[#DCFCE7]',
    iconColor: '#22C55E',
  },
  {
    label: 'Vendor Payment',
    subLabel: 'Office Supplies Inc',
    date: 'Yesterday, 4:20 PM',
    amount: '$2,450',
    isCredit: false,
    icon: 'arrow-up-outline',
    iconBg: 'bg-[#F3F4F6]',
    iconColor: '#555',
  },
  {
    label: 'Investment Return',
    subLabel: 'Reserve Fund',
    date: 'Apr 3, 2026',
    amount: '+$3,200',
    isCredit: true,
    icon: 'arrow-down-outline',
    iconBg: 'bg-[#DCFCE7]',
    iconColor: '#22C55E',
  },
]

function RecentActivity() {
  return (
    <View className="mx-4 mt-6">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-base font-semibold text-[#111]">Recent Activity</Text>
        <TouchableOpacity>
          <Text className="text-sm font-medium text-[#3B82F6]">View All</Text>
        </TouchableOpacity>
      </View>
      <View className="bg-white rounded-2xl overflow-hidden border border-[#F3F4F6]">
        {recentActivity.map((item, index) => (
          <View key={item.label + index}>
            <View className="flex-row items-center px-4 py-4 gap-3">
              <View className={`w-10 h-10 rounded-full justify-center items-center ${item.iconBg}`}>
                <Ionicons name={item.icon as any} size={18} color={item.iconColor} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-[#111]">{item.label}</Text>
                <Text className="text-xs text-[#888]">{item.subLabel}</Text>
                <Text className="text-xs text-[#aaa] mt-0.5">{item.date}</Text>
              </View>
              <Text className={`text-sm font-semibold ${item.isCredit ? 'text-[#22C55E]' : 'text-[#111]'}`}>
                {item.amount}
              </Text>
            </View>
            {index < recentActivity.length - 1 && (
              <View className="h-px bg-[#F3F4F6] mx-4" />
            )}
          </View>
        ))}
      </View>
    </View>
  )
}

function AccountsList() {
  return (
    <View className="mx-4 mt-6">
      <Text className="text-base font-semibold text-[#111] mb-3">Accounts</Text>
      <View className="bg-white rounded-2xl overflow-hidden border border-[#F3F4F6]">
        {accounts.map((account, index) => (
          <View key={account.label}>
            <View className="p-4">
              <View className="flex-row items-center gap-3 mb-4">
                <View
                  className={`w-12 h-12 rounded-2xl justify-center items-center ${account.iconBg}`}
                >
                  <Ionicons name={account.icon as any} size={22} color="#fff" />
                </View>
                <View>
                  <Text className="text-sm font-semibold text-[#111]">{account.label}</Text>
                  <Text className="text-xs text-[#888]">{account.subLabel}</Text>
                </View>
              </View>
              <View className="h-px bg-[#F3F4F6] mb-3" />
              <View className="flex-row justify-between items-center">
                <Text className="text-sm text-[#888]">Available Balance</Text>
                <Text className="text-lg font-bold text-[#111]">{account.balance}</Text>
              </View>
            </View>
            {index < accounts.length - 1 && <View className="h-2 bg-[#F9FAFB]" />}
          </View>
        ))}
      </View>
    </View>
  )
}

export default function WalletScreen() {
  return (
    <ScrollView className="flex-1 bg-[#F9FAFB]" showsVerticalScrollIndicator={false}>
      <BalanceCard />
      <AccountsList />
      <RecentActivity />
      <View className="h-8" />
    </ScrollView>
  )
}