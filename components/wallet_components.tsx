import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

type WalletQuickAction =
{
	label: string
	icon:  IoniconName
}

type WalletAccount =
{
	label:    string
	subLabel: string
	icon:     IoniconName
	iconBg:   string
	balance:  string
}

type WalletActivity =
{
	label:     string
	subLabel:  string
	date:      string
	amount:    string
	isCredit:  boolean
	icon:      IoniconName
	iconBg:    string
	iconColor: string
}

// Builds a fully-initialized wallet quick-action descriptor from its label and icon.
function createWalletQuickAction(label: string, icon: IoniconName): WalletQuickAction
{
	return { label, icon }
}

// Builds a fully-initialized wallet account summary from its label, sub-label, icon, background, and balance.
function createWalletAccount
(
	label: string,
	subLabel: string,
	icon: IoniconName,
	iconBg: string,
	balance: string,
): WalletAccount
{
	return { label, subLabel, icon, iconBg, balance }
}

// Builds a fully-initialized wallet activity entry from its label, timing, amount, credit flag, and icon styling.
function createWalletActivity
(
	label: string,
	subLabel: string,
	date: string,
	amount: string,
	isCredit: boolean,
	icon: IoniconName,
	iconBg: string,
	iconColor: string,
): WalletActivity
{
	return { label, subLabel, date, amount, isCredit, icon, iconBg, iconColor }
}

// Renders the dark balance card with the total balance and the row of wallet quick actions.
function BalanceCard(): React.JSX.Element
{
	return (
		<View className="bg-[#1A2340] rounded-[20px] p-6 mx-4 mt-4">
			<View className="flex-row justify-between items-center mb-3">
				<Text className="text-white/60 text-sm">Total Balance</Text>
				<Ionicons name="eye-outline" size={22} color="rgba(255,255,255,0.6)" />
			</View>

			<Text className="text-white text-[40px] font-bold mb-6">$1,248,520</Text>

			<View className="flex-row justify-between gap-3">
				{quickActions.map
				(
					(action) =>
					(
						<TouchableOpacity
							key={action.label}
							className="flex-1 bg-white/10 rounded-2xl py-3 items-center gap-1.5"
						>
							<View className="w-9 h-9 rounded-full bg-white/10 justify-center items-center">
								<Ionicons name={action.icon} size={18} color="#fff" />
							</View>
							<Text className="text-white text-xs font-medium">{action.label}</Text>
						</TouchableOpacity>
					)
				)}
			</View>
		</View>
	)
}

const quickActions: WalletQuickAction[] =
[
	createWalletQuickAction('Add', 'add-outline'),
	createWalletQuickAction('Send', 'paper-plane-outline'),
	createWalletQuickAction('Request', 'download-outline'),
	createWalletQuickAction('More', 'arrow-up-outline'),
]

const accounts: WalletAccount[] =
[
	createWalletAccount('Main Operating Account', 'Checking — ****4521', 'business-outline', 'bg-[#3B82F6]', '$824,500'),
	createWalletAccount('Payroll Account', 'Checking — ****7892', 'wallet-outline', 'bg-[#22C55E]', '$324,020'),
	createWalletAccount('Reserve Fund', 'Savings — ****3341', 'card-outline', 'bg-[#A855F7]', '$100,000'),
]

const recentActivity: WalletActivity[] =
[
	createWalletActivity('Transfer to Payroll', 'Main → Payroll', 'Today, 2:30 PM', '$50,000', false, 'arrow-up-outline', 'bg-[#F3F4F6]', '#555'),
	createWalletActivity('Client Payment', 'ABC Corp', 'Today, 10:15 AM', '+$75,000', true, 'arrow-down-outline', 'bg-[#DCFCE7]', '#22C55E'),
	createWalletActivity('Vendor Payment', 'Office Supplies Inc', 'Yesterday, 4:20 PM', '$2,450', false, 'arrow-up-outline', 'bg-[#F3F4F6]', '#555'),
	createWalletActivity('Investment Return', 'Reserve Fund', 'Apr 3, 2026', '+$3,200', true, 'arrow-down-outline', 'bg-[#DCFCE7]', '#22C55E'),
]

// Renders the recent-activity list with credit/debit styling and row separators.
function RecentActivity(): React.JSX.Element
{
	return (
		<View className="mx-4 mt-6">
			<View className="flex-row justify-between items-center mb-3">
				<Text className="text-base font-semibold text-[#111]">Recent Activity</Text>
				<TouchableOpacity>
					<Text className="text-sm font-medium text-[#3B82F6]">View All</Text>
				</TouchableOpacity>
			</View>
			<View className="bg-white rounded-2xl overflow-hidden border border-[#F3F4F6]">
				{recentActivity.map
				(
					(item, index) =>
					(
						<View key={item.label + index}>
							<View className="flex-row items-center px-4 py-4 gap-3">
								<View className={`w-10 h-10 rounded-full justify-center items-center ${item.iconBg}`}>
									<Ionicons name={item.icon} size={18} color={item.iconColor} />
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
							{index < recentActivity.length - 1 &&
							(
								<View className="h-px bg-[#F3F4F6] mx-4" />
							)}
						</View>
					)
				)}
			</View>
		</View>
	)
}

// Renders the list of accounts with balances and per-account separators.
function AccountsList(): React.JSX.Element
{
	return (
		<View className="mx-4 mt-6">
			<Text className="text-base font-semibold text-[#111] mb-3">Accounts</Text>
			<View className="bg-white rounded-2xl overflow-hidden border border-[#F3F4F6]">
				{accounts.map
				(
					(account, index) =>
					(
						<View key={account.label}>
							<View className="p-4">
								<View className="flex-row items-center gap-3 mb-4">
									<View
										className={`w-12 h-12 rounded-2xl justify-center items-center ${account.iconBg}`}
									>
										<Ionicons name={account.icon} size={22} color="#fff" />
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
					)
				)}
			</View>
		</View>
	)
}

// Composes the wallet screen from the balance card, accounts list, and recent-activity sections.
export default function WalletScreen(): React.JSX.Element
{
	return (
		<ScrollView className="flex-1 bg-[#F9FAFB]" showsVerticalScrollIndicator={false}>
			<BalanceCard />
			<AccountsList />
			<RecentActivity />
			<View className="h-8" />
		</ScrollView>
	)
}
