import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

type QuickAction =
{
	label: string
	icon:  IoniconName
	color: string
}

type PayrollItem =
{
	label:     string
	subLabel:  string
	icon:      IoniconName
	iconColor: string
	bgColor:   string
	amount:    string
}

// Builds a fully-initialized quick-action tile descriptor from its label, icon, and color class.
function createQuickAction(label: string, icon: IoniconName, color: string): QuickAction
{
	return { label, icon, color }
}

// Builds a fully-initialized payroll summary line item from its label, sub-label, icon, colors, and amount.
function createPayrollItem
(
	label: string,
	subLabel: string,
	icon: IoniconName,
	iconColor: string,
	bgColor: string,
	amount: string,
): PayrollItem
{
	return { label, subLabel, icon, iconColor, bgColor, amount }
}

// Renders the headline company-balance card with payroll and headcount highlights.
function BalanceCard(): React.JSX.Element
{
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

const actions: QuickAction[] =
[
	createQuickAction('Run Payroll', 'cash-outline', 'bg-[#22C55E]'),
	createQuickAction('Employees', 'people-outline', 'bg-[#A855F7]'),
	createQuickAction('Reports', 'document-text-outline', 'bg-[#F97316]'),
	createQuickAction('Cards', 'card-outline', 'bg-[#3B82F6]'),
]

// Renders the row of quick-action tiles across the top of the dashboard.
function QuickActions(): React.JSX.Element
{
	return (
		<View className="mx-4 mt-6">
			<Text className="text-base font-semibold text-[#111] mb-4">Quick Actions</Text>
			<View className="flex-row justify-between">
				{actions.map
				(
					(action) =>
					(
						<TouchableOpacity key={action.label} className="items-center gap-2">
							<View className={`w-14 h-14 rounded-2xl justify-center items-center ${action.color}`}>
								<Ionicons name={action.icon} size={24} color="#fff" />
							</View>
							<Text className="text-xs text-[#333] text-center">{action.label}</Text>
						</TouchableOpacity>
					)
				)}
			</View>
		</View>
	)
}

const payrollItems: PayrollItem[] =
[
	createPayrollItem('Processed', '235 employees', 'checkmark-circle-outline', '#22C55E', 'bg-[#DCFCE7]', '$245,100'),
	createPayrollItem('Pending', '8 employees', 'time-outline', '#EAB308', 'bg-[#FEF9C3]', '$8,450'),
	createPayrollItem('Issues', '5 employees', 'alert-circle-outline', '#EF4444', 'bg-[#FEE2E2]', '$4,850'),
]

// Renders the payroll summary panel including the next payroll date and per-status breakdown.
function PayrollSummary(): React.JSX.Element
{
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

			{payrollItems.map
			(
				(item) =>
				(
					<View key={item.label} className="flex-row items-center justify-between py-3 border-b border-[#F3F4F6] last:border-b-0">
						<View className="flex-row items-center gap-3">
							<View className={`w-10 h-10 rounded-full justify-center items-center ${item.bgColor}`}>
								<Ionicons name={item.icon} size={20} color={item.iconColor} />
							</View>
							<View>
								<Text className="text-sm font-semibold text-[#111]">{item.label}</Text>
								<Text className="text-xs text-[#888]">{item.subLabel}</Text>
							</View>
						</View>
						<Text className="text-sm font-semibold text-[#111]">{item.amount}</Text>
					</View>
				)
			)}
		</View>
	)
}

// Composes the full dashboard view from the balance, quick-actions, and payroll-summary sections.
export default function Dashboard(): React.JSX.Element
{
	return (
		<View className="flex-1 bg-[#F9FAFB]">
			<BalanceCard />
			<QuickActions />
			<PayrollSummary />
		</View>
	)
}
