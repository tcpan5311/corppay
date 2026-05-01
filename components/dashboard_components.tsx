import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'

function BalanceCard() {
  return (
    <View className="bg-[#2B4EFF] rounded-[20px] p-6 mx-4 mt-4">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-white/80 text-sm">Total Company Balance</Text>
        <Ionicons name="eye-outline" size={22} color="#fff" />
      </View>

      <Text className="text-white text-[36px] font-bold mb-1.5">$1,248,520</Text>
      <View className="flex-row items-center mb-5">
        <Ionicons name="trending-up-outline" size={16} color="#a0f0c0" />
        <Text className="text-[#a0f0c0] text-[13px]">  +12.5% from last month</Text>
      </View>

      <View className="h-px bg-white/20 mb-4" />

      <View className="flex-row justify-between">
        <View>
          <Text className="text-white/70 text-xs mb-1">Monthly Payroll</Text>
          <Text className="text-white text-lg font-semibold">$258,400</Text>
        </View>
        <View>
          <Text className="text-white/70 text-xs mb-1">Active Employees</Text>
          <Text className="text-white text-lg font-semibold">248</Text>
        </View>
      </View>
    </View>
  )
}

const actions = [
  { label: 'Run Payroll', icon: 'cash-outline', color: 'bg-[#22C55E]' },
  { label: 'Employees', icon: 'people-outline', color: 'bg-[#A855F7]' },
  { label: 'Reports', icon: 'document-text-outline', color: 'bg-[#F97316]' },
  { label: 'Cards', icon: 'card-outline', color: 'bg-[#3B82F6]' },
]

function QuickActions() {
  return (
    <View className="mx-4 mt-6">
      <Text className="text-base font-semibold text-[#111] mb-4">Quick Actions</Text>
      <View className="flex-row justify-between">
        {actions.map((action) => (
          <TouchableOpacity key={action.label} className="items-center gap-2">
            <View className={`w-14 h-14 rounded-2xl justify-center items-center ${action.color}`}>
              <Ionicons name={action.icon as any} size={24} color="#fff" />
            </View>
            <Text className="text-xs text-[#333] text-center">{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const payrollItems = [
  {
    label: 'Processed',
    subLabel: '235 employees',
    icon: 'checkmark-circle-outline',
    iconColor: '#22C55E',
    bgColor: 'bg-[#DCFCE7]',
    amount: '$245,100',
  },
  {
    label: 'Pending',
    subLabel: '8 employees',
    icon: 'time-outline',
    iconColor: '#EAB308',
    bgColor: 'bg-[#FEF9C3]',
    amount: '$8,450',
  },
  {
    label: 'Issues',
    subLabel: '5 employees',
    icon: 'alert-circle-outline',
    iconColor: '#EF4444',
    bgColor: 'bg-[#FEE2E2]',
    amount: '$4,850',
  },
]

function PayrollSummary() {
  return (
    <View className="mx-4 mt-6 bg-white rounded-2xl p-4 shadow-sm">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-base font-semibold text-[#111]">Payroll Summary</Text>
        <TouchableOpacity>
          <Text className="text-sm font-medium text-[#3B82F6]">View All</Text>
        </TouchableOpacity>
      </View>

      <View className="bg-[#F0FDF4] rounded-2xl p-4 mb-4">
        <View className="flex-row items-center gap-2 mb-2">
          <Ionicons name="calendar-outline" size={16} color="#22C55E" />
          <Text className="text-sm text-[#444]">Next Payroll Date</Text>
        </View>
        <Text className="text-2xl font-bold text-[#111] mb-1">April 15, 2026</Text>
        <Text className="text-sm text-[#666]">10 days remaining</Text>
      </View>

      {payrollItems.map((item) => (
        <View key={item.label} className="flex-row items-center justify-between py-3 border-b border-[#F3F4F6] last:border-b-0">
          <View className="flex-row items-center gap-3">
            <View className={`w-10 h-10 rounded-full justify-center items-center ${item.bgColor}`}>
              <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
            </View>
            <View>
              <Text className="text-sm font-semibold text-[#111]">{item.label}</Text>
              <Text className="text-xs text-[#888]">{item.subLabel}</Text>
            </View>
          </View>
          <Text className="text-sm font-semibold text-[#111]">{item.amount}</Text>
        </View>
      ))}
    </View>
  )
}

export default function Dashboard() 
{
  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <BalanceCard />
      <QuickActions />
      <PayrollSummary />
    </View>
  )
}