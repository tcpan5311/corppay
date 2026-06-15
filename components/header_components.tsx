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

// Derives up-to-two-letter uppercase initials from an email local-part, falling back to "CP".
function deriveInitials(email: string | null): string
{
	if (email === null || email === '') return 'CP'
	const localPart = email.split('@')[0]
	const letters = localPart.split(/[._-]/).map((part) => part[0]).slice(0, 2)
	return letters.join('').toUpperCase()
}

// Builds a human-readable display name from an email local-part, falling back to "CorpPay".
function deriveDisplayName(email: string | null): string
{
	if (email === null || email === '') return 'CorpPay'
	const localPart = email.split('@')[0]
	return localPart.split(/[._-]/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

// Capitalises a role string for display, returning empty string when no role is present.
function deriveRoleLabel(role: string | null): string
{
	if (role === null || role === '') return ''
	return role.charAt(0).toUpperCase() + role.slice(1)
}

// Renders the top header bar with a menu icon, user avatar with initials, notifications, and a web sign-out sheet.
export default function HeaderBar(): React.JSX.Element
{
	const { user, logout } = useAuth()
	const [menuVisible, setMenuVisible] = useState(false)

	const userEmail = user === null ? null : user.email
	const userRole  = user === null ? null : user.role
	const initials    = deriveInitials(userEmail)
	const displayName = deriveDisplayName(userEmail)
	const roleLabel   = deriveRoleLabel(userRole)
	const emailLabel  = userEmail === null ? '' : userEmail

	// Opens the web sign-out sheet on web and shows a native action sheet elsewhere.
	function handleAvatarPress()
	{
		if (Platform.OS === 'web')
		{
			setMenuVisible(true)
		}
		else
		{
			Alert.alert
			(
				displayName,
				emailLabel,
				[
					{ text: 'Cancel', style: 'cancel' },
					{ text: 'Sign Out', style: 'destructive', onPress: logout },
				],
			)
		}
	}

	return (
		<View className="flex-row items-center justify-between px-4 pt-14 pb-3 bg-white border-b border-[#F3F4F6]">

			<TouchableOpacity>
				<Ionicons name="menu-outline" size={26} color="#111" />
			</TouchableOpacity>

			<TouchableOpacity className="flex-row items-center gap-2" onPress={handleAvatarPress}>
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

			{Platform.OS === 'web' &&
			(
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
													{emailLabel}
												</Text>
											</View>

											<TouchableOpacity
												onPress=
												{
													() =>
													{
														setMenuVisible(false)
														logout()
													}
												}
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
