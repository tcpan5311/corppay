import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native'

const API_BASE = process.env.EXPO_PUBLIC_API_URL

type TokenGateState =
{
	code:        string
	isChecking:  boolean
	errorMsg:    string
	showCode:    boolean
}

// Creates a fully initialized TokenGateState with empty defaults.
function createTokenGateState(): TokenGateState
{
	return {
		code:       '',
		isChecking: false,
		errorMsg:   '',
		showCode:   false,
	}
}

type ValidateTokenResponse =
{
	valid:         boolean
	error:         string
	sessionToken:  string
}

// Creates a fully initialized ValidateTokenResponse defaulting to invalid with empty strings.
function createValidateTokenResponse(): ValidateTokenResponse
{
	return { valid: false, error: '', sessionToken: '' }
}

// Submits a 6-digit TOTP code to the server and returns the validation response including the session token.
async function postValidateToken(code: string): Promise<ValidateTokenResponse>
{
	const result = createValidateTokenResponse()

	const response = await fetch(`${API_BASE}/admin/review/validate-token`, {
		method:  'POST',
		headers: { 'Content-Type': 'application/json' },
		body:    JSON.stringify({ code }),
	})

	const data = (await response.json()) as Record<string, unknown>

	if (!response.ok)
	{
		result.error = typeof data['error'] === 'string' ? data['error'] : 'Invalid code.'
		return result
	}

	const sessionToken = typeof data['sessionToken'] === 'string' ? data['sessionToken'] : ''

	if (sessionToken === '')
	{
		result.error = 'Server did not return a session token.'
		return result
	}

	result.valid        = true
	result.sessionToken = sessionToken
	return result
}

// Extracts a user-friendly error message from an unknown thrown value.
function resolveErrorMessage(e: unknown): string
{
	if (e !== null && typeof e === 'object' && 'message' in e)
	{
		const msg = (e as Record<string, unknown>)['message']
		if (typeof msg === 'string') return msg
	}
	return 'Unable to verify code. Please try again.'
}

// Renders the admin token gate screen that validates a TOTP code before allowing entry to the review dashboard.
export default function AdminReviewGateScreen()
{
	const router = useRouter()

	const [state, setState] = useState<TokenGateState>(createTokenGateState())

	// Updates the code field value in state.
	const handleCodeChange = (v: string) =>
	{
		setState((prev) => ({ ...prev, code: v, errorMsg: '' }))
	}

	// Toggles the secure text entry visibility for the code field.
	const handleToggleShow = () =>
	{
		setState((prev) => ({ ...prev, showCode: !prev.showCode }))
	}

	// Submits the TOTP code, stores the returned session token in global state on success, and navigates to the dashboard.
	async function handleSubmit(): Promise<void>
	{
		const trimmed = state.code.trim()

		if (trimmed === '')
		{
			setState((prev) => ({ ...prev, errorMsg: 'Please enter the 6-digit authenticator code.' }))
			return
		}

		setState((prev) => ({ ...prev, isChecking: true, errorMsg: '' }))

		try
		{
			const result = await postValidateToken(trimmed)

			if (!result.valid)
			{
				setState((prev) => ({
					...prev,
					isChecking: false,
					errorMsg:   result.error !== '' ? result.error : 'Invalid code.',
				}))
				return
			}

			const globalRecord           = global as Record<string, unknown>
			globalRecord['__adminToken'] = result.sessionToken

			router.replace('/admin/review/dashboard' as never)
		}
		catch (e)
		{
			setState((prev) => ({
				...prev,
				isChecking: false,
				errorMsg:   resolveErrorMessage(e),
			}))
		}
	}

	const hasError        = state.errorMsg !== ''
	const webCursorStyle  = Platform.OS === 'web' ? { cursor: 'pointer' } : null
	const webContainerCls = Platform.OS === 'web' ? 'max-w-[460px] w-full self-center' : ''

	return (
		<View className="flex-1 bg-[#F9FAFB]">
			<KeyboardAvoidingView
				className="flex-1"
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			>
				<View className="flex-1 justify-center px-6">
					<View className={webContainerCls}>

						{/* Icon badge */}
						<View className="items-center mb-8">
							<View className="w-20 h-20 bg-gray-900 rounded-3xl items-center justify-center shadow-lg mb-4">
								<MaterialCommunityIcons name="shield-lock-outline" size={40} color="#FFFFFF" />
							</View>
							<Text className="text-gray-900 text-2xl font-bold text-center">Admin Access</Text>
							<Text className="text-gray-500 text-sm text-center mt-1">
								Enter the 6-digit code from your authenticator app
							</Text>
						</View>

						{/* Code input card */}
						<View className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-6 mb-4">
							<Text className="text-gray-700 text-sm font-medium mb-2">Authenticator Code</Text>

							<View
								className={`flex-row items-center bg-gray-50 border rounded-xl px-4 py-3.5 ${
									hasError ? 'border-red-400 bg-red-50' : 'border-gray-200'
								}`}
							>
								<MaterialCommunityIcons
									name="cellphone-key"
									size={18}
									color={hasError ? '#F87171' : '#9CA3AF'}
									style={{ marginRight: 10 }}
								/>
								<TextInput
									className="flex-1 text-gray-800 text-sm"
									placeholder="000000"
									placeholderTextColor="#9CA3AF"
									value={state.code}
									onChangeText={handleCodeChange}
									secureTextEntry={!state.showCode}
									autoCapitalize="none"
									autoCorrect={false}
									keyboardType="number-pad"
									maxLength={6}
									accessibilityLabel="Authenticator code"
									{...(Platform.OS === 'web' ? { autoComplete: 'off' } : {})}
								/>
								<TouchableOpacity onPress={handleToggleShow} style={{ padding: 2 }}>
									<MaterialCommunityIcons
										name={state.showCode ? 'eye-off-outline' : 'eye-outline'}
										size={18}
										color="#9CA3AF"
									/>
								</TouchableOpacity>
							</View>

							{hasError && (
								<View className="flex-row items-center mt-2 ml-1">
									<MaterialCommunityIcons
										name="alert-circle-outline"
										size={13}
										color="#DC2626"
										style={{ marginRight: 4 }}
									/>
									<Text className="text-red-600 text-xs flex-1" accessibilityRole="alert">
										{state.errorMsg}
									</Text>
								</View>
							)}
						</View>

						{/* Submit button */}
						<TouchableOpacity
							className={`rounded-2xl py-4 items-center shadow-md ${
								state.isChecking || state.code.trim() === ''
									? 'bg-gray-300 shadow-gray-200'
									: 'bg-gray-900 shadow-gray-400'
							}`}
							onPress={handleSubmit}
							disabled={state.isChecking || state.code.trim() === ''}
							style={webCursorStyle as object}
							accessibilityRole="button"
							accessibilityLabel="Submit authenticator code"
						>
							{state.isChecking
								? <ActivityIndicator color="#fff" />
								: (
									<Text className={`text-base font-semibold ${
										state.code.trim() === '' ? 'text-gray-400' : 'text-white'
									}`}>
										Verify Code
									</Text>
								)
							}
						</TouchableOpacity>

						<Text className="text-gray-400 text-xs text-center mt-6">
							Code is validated server-side. Sessions expire after 2 hours.
						</Text>

					</View>
				</View>
			</KeyboardAvoidingView>
		</View>
	)
}