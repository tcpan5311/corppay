import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Href, useRouter } from 'expo-router'
import React from 'react'
import {
	ScrollView,
	Text,
	TouchableOpacity,
	View
} from 'react-native'

// Renders the registration entry screen offering the new-business and join-existing-business paths.
export default function RegisterSelectScreen()
{
	const router = useRouter()

	return (
		<View className="flex-1 bg-[#F9FAFB]">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ flexGrow: 1 }}
				keyboardShouldPersistTaps="handled"
			>
				<View className="bg-blue-600 rounded-b-3xl px-6 pt-14 pb-12 overflow-hidden">
					<View className="absolute top-4 right-4 w-32 h-32 rounded-full bg-blue-500 opacity-40" />
					<View className="absolute top-16 right-16 w-20 h-20 rounded-full bg-blue-400 opacity-30" />

					<View className="flex-row items-center mb-8">
						<View className="w-11 h-11 bg-white rounded-xl items-center justify-center mr-3">
							<View className="w-6 h-6 bg-blue-600 rounded-md" />
						</View>
						<Text className="text-white text-xl font-semibold tracking-wide">
							CorpPay
						</Text>
					</View>

					<Text className="text-white text-4xl font-bold mb-2">
						Get Started
					</Text>
					<Text className="text-blue-200 text-sm">
						Choose how you'd like to register
					</Text>
				</View>

				<View className="flex-1 px-6 pt-8 pb-6">

					<TouchableOpacity
						className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-4"
						onPress={() => router.push('/register-business' as Href)}
						activeOpacity={0.85}
					>
						<View className="flex-row items-center mb-3">
							<View className="w-12 h-12 bg-blue-600 rounded-2xl items-center justify-center mr-4">
								<MaterialCommunityIcons name="file-document-outline" size={24} color="#fff" />
							</View>
							<Text className="text-gray-800 text-lg font-bold flex-1">
								Register New Business
							</Text>
						</View>

						<Text className="text-gray-500 text-sm mb-4 leading-5">
							Set up a new business entity with CorpPay. Perfect for companies starting fresh.
						</Text>

						<View className="gap-y-2 mb-5">
							{[
								'Complete business registration',
								'Upload SSM documents',
								'Add director information',
								'Full admin access',
							].map
							(
								(item) =>
								(
									<View key={item} className="flex-row items-center">
										<MaterialCommunityIcons
											name="check-circle-outline"
											size={16}
											color="#3B82F6"
											style={{ marginRight: 8 }}
										/>
										<Text className="text-gray-600 text-sm">{item}</Text>
									</View>
								)
							)}
						</View>

						<View className="flex-row items-center">
							<Text className="text-blue-600 text-xs font-bold tracking-widest uppercase mr-2">
								For Business Owners
							</Text>
							<MaterialCommunityIcons name="arrow-right" size={16} color="#3B82F6" />
						</View>
					</TouchableOpacity>

					<TouchableOpacity
						className="bg-purple-50 border border-purple-100 rounded-2xl p-5 mb-6"
						onPress={() => router.push('/register-user' as Href)}
						activeOpacity={0.85}
					>
						<View className="flex-row items-center mb-3">
							<View className="w-12 h-12 bg-purple-600 rounded-2xl items-center justify-center mr-4">
								<MaterialCommunityIcons name="account-plus-outline" size={24} color="#fff" />
							</View>
							<Text className="text-gray-800 text-lg font-bold flex-1">
								Join Existing Business
							</Text>
						</View>

						<Text className="text-gray-500 text-sm mb-4 leading-5">
							Create your account and link to an existing business. Perfect for employees and team members.
						</Text>

						<View className="gap-y-2 mb-5">
							{[
								'Quick personal registration',
								'Link to company account',
								'Access payroll & benefits',
								'Employee permissions',
							].map
							(
								(item) =>
								(
									<View key={item} className="flex-row items-center">
										<MaterialCommunityIcons
											name="check-circle-outline"
											size={16}
											color="#9333EA"
											style={{ marginRight: 8 }}
										/>
										<Text className="text-gray-600 text-sm">{item}</Text>
									</View>
								)
							)}
						</View>

						<View className="flex-row items-center">
							<Text className="text-purple-600 text-xs font-bold tracking-widest uppercase mr-2">
								For Employees
							</Text>
							<MaterialCommunityIcons name="arrow-right" size={16} color="#9333EA" />
						</View>
					</TouchableOpacity>

					<View className="flex-row items-center mb-6">
						<View className="flex-1 h-px bg-gray-200" />
						<Text className="text-gray-400 text-sm mx-4">or</Text>
						<View className="flex-1 h-px bg-gray-200" />
					</View>

					<View className="flex-row justify-center mb-8">
						<Text className="text-gray-500 text-sm">Already have an account? </Text>
						<TouchableOpacity onPress={() => router.replace('/login' as Href)}>
							<Text className="text-blue-600 text-sm font-semibold">Sign In</Text>
						</TouchableOpacity>
					</View>

					<View className="flex-row bg-blue-600 rounded-2xl p-4 items-start">
						<View className="w-9 h-9 bg-blue-500 rounded-xl items-center justify-center mr-3 mt-0.5">
							<Text className="text-white text-base font-bold">?</Text>
						</View>
						<View className="flex-1">
							<Text className="text-white text-sm font-semibold mb-1">
								Not sure which to choose?
							</Text>
							<Text className="text-blue-200 text-xs leading-5">
								If you're setting up payroll for your company, choose{' '}
								<Text className="text-white font-semibold">Register New Business.</Text>
								{' '}If you're joining as an employee, choose{' '}
								<Text className="text-white font-semibold">Join Existing Business.</Text>
							</Text>
						</View>
					</View>

				</View>
			</ScrollView>
		</View>
	)
}
