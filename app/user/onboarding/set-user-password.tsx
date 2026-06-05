import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native'
import {
    validateAdminPassword,
    validatePasswordConfirmation,
} from '../../../corppay-backend/src/validation/adminSetPasswordValidation'

const API_BASE = process.env.EXPO_PUBLIC_API_URL

// ─── Types ────────────────────────────────────────────────────────────────────

type TokenVerifyPhase = 'verifying' | 'invalid' | 'ready' | 'success'

type SetPasswordState =
{
	phase:           TokenVerifyPhase
	verifyReason:    string
	email:           string
	role:            string
	department:      string
	password:        string
	confirmPassword: string
	showPassword:    boolean
	showConfirm:     boolean
	passwordError:   string
	confirmError:    string
	isSubmitting:    boolean
	submitError:     string
}

// Creates a fully initialized SetPasswordState defaulting to the verifying phase with empty fields.
function createSetPasswordState(): SetPasswordState
{
	return {
		phase:           'verifying',
		verifyReason:    '',
		email:           '',
		role:            '',
		department:      '',
		password:        '',
		confirmPassword: '',
		showPassword:    false,
		showConfirm:     false,
		passwordError:   '',
		confirmError:    '',
		isSubmitting:    false,
		submitError:     '',
	}
}

// ─── API ──────────────────────────────────────────────────────────────────────

type VerifyTokenApiResponse =
{
	valid:      boolean
	reason:     string
	email:      string
	role:       string
	department: string
}

// Creates a fully initialized VerifyTokenApiResponse defaulting to invalid with empty strings.
function createVerifyTokenApiResponse(): VerifyTokenApiResponse
{
	return { valid: false, reason: '', email: '', role: '', department: '' }
}

// Calls the user onboarding verify-token endpoint and returns the parsed response with the assigned role and department.
async function fetchVerifyToken(token: string): Promise<VerifyTokenApiResponse>
{
	const result   = createVerifyTokenApiResponse()
	const response = await fetch(
		`${API_BASE}/user-onboarding/verify-token?token=${encodeURIComponent(token)}`
	)
	const data = (await response.json()) as Record<string, unknown>

	if (!response.ok)
	{
		result.reason = typeof data['reason'] === 'string' ? data['reason'] : 'Invalid or expired link.'
		return result
	}

	result.valid      = true
	result.email      = typeof data['email']      === 'string' ? data['email']      : ''
	result.role       = typeof data['role']       === 'string' ? data['role']       : ''
	result.department = typeof data['department'] === 'string' ? data['department'] : ''
	return result
}

// Submits the new password to the user onboarding set-password endpoint and returns an error string on failure.
async function postSetPassword(token: string, password: string): Promise<string>
{
	const response = await fetch(`${API_BASE}/user-onboarding/set-password`, {
		method:  'POST',
		headers: { 'Content-Type': 'application/json' },
		body:    JSON.stringify({ token, password }),
	})

	if (!response.ok)
	{
		const data = (await response.json()) as Record<string, unknown>
		return typeof data['error'] === 'string' ? data['error'] : 'Account setup failed.'
	}

	return ''
}

// Extracts a user-friendly error message from an unknown thrown value.
function resolveErrorMessage(e: unknown): string
{
	if (e !== null && typeof e === 'object' && 'message' in e)
	{
		const msg = (e as Record<string, unknown>)['message']
		if (typeof msg === 'string') return msg
	}
	return 'An unexpected error occurred.'
}

// ─── Validation ───────────────────────────────────────────────────────────────

// Delegates password validation to the shared rule set and returns an empty string on success.
function validatePassword(value: string): string
{
	const error = validateAdminPassword(value)
	return error !== null ? error : ''
}

// Delegates confirmation validation to the shared rule set and returns an empty string on success.
function validateConfirmPassword(password: string, confirm: string): string
{
	const error = validatePasswordConfirmation(password, confirm)
	return error !== null ? error : ''
}

// ─── Token Extraction ─────────────────────────────────────────────────────────

// Resolves a scalar string from a route param that may be a string or string array.
function resolveScalarParam(raw: string | string[]): string
{
	if (Array.isArray(raw)) return raw.length > 0 ? raw[0] : ''
	return raw
}

// ─── Screen ───────────────────────────────────────────────────────────────────

// Renders the user onboarding password setup screen, verifying the token on mount and collecting a new password.
export default function SetUserPasswordScreen()
{
	const router = useRouter()
	const params = useLocalSearchParams()

	const rawToken = params['token']
	const tokenStr = rawToken !== undefined ? resolveScalarParam(rawToken) : ''

	const [state, setState] = useState<SetPasswordState>(createSetPasswordState())

	useEffect(
		() =>
		{
			if (tokenStr === '')
			{
				setState((prev) => ({
					...prev,
					phase:        'invalid',
					verifyReason: 'No onboarding token was provided.',
				}))
				return
			}
			verifyToken()
		},
		[]
	)

	// Calls the verify-token API and transitions the screen to the ready or invalid phase.
	async function verifyToken(): Promise<void>
	{
		try
		{
			const result = await fetchVerifyToken(tokenStr)

			if (!result.valid)
			{
				setState((prev) => ({ ...prev, phase: 'invalid', verifyReason: result.reason }))
				return
			}

			setState((prev) => ({
				...prev,
				phase:      'ready',
				email:      result.email,
				role:       result.role,
				department: result.department,
			}))
		}
		catch (e)
		{
			setState((prev) => ({ ...prev, phase: 'invalid', verifyReason: resolveErrorMessage(e) }))
		}
	}

	// Validates both password fields, submits the form, and transitions to the success phase on completion.
	async function handleSubmit(): Promise<void>
	{
		const passwordErr = validatePassword(state.password)
		const confirmErr  = validateConfirmPassword(state.password, state.confirmPassword)

		if (passwordErr !== '' || confirmErr !== '')
		{
			setState((prev) => ({ ...prev, passwordError: passwordErr, confirmError: confirmErr }))
			return
		}

		setState((prev) => ({ ...prev, isSubmitting: true, submitError: '', passwordError: '', confirmError: '' }))

		try
		{
			const errorMsg = await postSetPassword(tokenStr, state.password)

			if (errorMsg !== '')
			{
				setState((prev) => ({ ...prev, isSubmitting: false, submitError: errorMsg }))
				return
			}

			setState((prev) => ({ ...prev, phase: 'success', isSubmitting: false }))

			setTimeout(
				() =>
				{
					if (Platform.OS === 'web')
					{
						window.close()
					}
					else
					{
						router.replace('/login' as never)
					}
				},
				3000,
			)
		}
		catch (e)
		{
			setState((prev) => ({ ...prev, isSubmitting: false, submitError: resolveErrorMessage(e) }))
		}
	}

	// Updates the password field and re-validates it if it has content.
	const handlePasswordChange = (v: string) =>
	{
		setState((prev) => ({ ...prev, password: v, passwordError: validatePassword(v) }))
	}

	// Updates the confirm field and re-validates it against the current password.
	const handleConfirmChange = (v: string) =>
	{
		setState((prev) => ({
			...prev,
			confirmPassword: v,
			confirmError:    validateConfirmPassword(prev.password, v),
		}))
	}

	// Toggles the password field visibility.
	const handleTogglePassword = () =>
	{
		setState((prev) => ({ ...prev, showPassword: !prev.showPassword }))
	}

	// Toggles the confirm password field visibility.
	const handleToggleConfirm = () =>
	{
		setState((prev) => ({ ...prev, showConfirm: !prev.showConfirm }))
	}

	const webContainerCls = Platform.OS === 'web' ? 'max-w-[480px] w-full self-center' : ''
	const webCursorStyle  = Platform.OS === 'web' ? { cursor: 'pointer' } : null

	const isFormReady = (
		state.phase === 'ready'         &&
		state.password !== ''           &&
		state.confirmPassword !== ''    &&
		state.passwordError === ''      &&
		state.confirmError  === ''      &&
		!state.isSubmitting
	)

	return (
		<View className="flex-1 bg-[#F9FAFB]">
			<KeyboardAvoidingView
				className="flex-1"
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			>
				<ScrollView
					className="flex-1"
					contentContainerStyle={{ flexGrow: 1 }}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					<View className={`flex-1 justify-center px-6 py-12 ${webContainerCls}`}>

						{/* ── Verifying phase ── */}
						{state.phase === 'verifying' && (
							<View className="items-center py-24">
								<ActivityIndicator size="large" color="#2563EB" />
								<Text className="text-gray-500 mt-4 text-sm">Verifying your link…</Text>
							</View>
						)}

						{/* ── Invalid phase ── */}
						{state.phase === 'invalid' && (
							<View className="items-center py-16 px-4">
								<View className="w-16 h-16 bg-red-100 rounded-2xl items-center justify-center mb-4">
									<MaterialCommunityIcons name="link-off" size={32} color="#DC2626" />
								</View>
								<Text className="text-gray-900 text-xl font-bold text-center mb-2">
									Link Unavailable
								</Text>
								<Text className="text-gray-500 text-sm text-center leading-5">
									{state.verifyReason}
								</Text>
							</View>
						)}

						{/* ── Ready phase ── */}
						{state.phase === 'ready' && (
							<>
								<View className="items-center mb-8">
									<View className="w-20 h-20 bg-blue-600 rounded-3xl items-center justify-center shadow-lg mb-4">
										<MaterialCommunityIcons name="lock-reset" size={40} color="#FFFFFF" />
									</View>
									<Text className="text-gray-900 text-2xl font-bold text-center">
										Set Your Password
									</Text>
									{state.email !== '' && (
										<Text className="text-gray-500 text-sm text-center mt-1">
											Setting up account for {state.email}
										</Text>
									)}
								</View>

								{(state.role !== '' || state.department !== '') && (
									<View className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 mb-4">
										<Text className="text-blue-800 text-xs font-semibold uppercase tracking-wide mb-2">
											Your Assignment
										</Text>
										<View className="flex-row items-center mb-1">
											<MaterialCommunityIcons
												name="badge-account-outline"
												size={16}
												color="#2563EB"
												style={{ marginRight: 8 }}
											/>
											<Text className="text-gray-700 text-sm">
												Role: <Text className="font-semibold">{state.role}</Text>
											</Text>
										</View>
										<View className="flex-row items-center">
											<MaterialCommunityIcons
												name="office-building-outline"
												size={16}
												color="#2563EB"
												style={{ marginRight: 8 }}
											/>
											<Text className="text-gray-700 text-sm">
												Department: <Text className="font-semibold">{state.department}</Text>
											</Text>
										</View>
									</View>
								)}

								<View className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-6 mb-4">

									<Text className="text-gray-700 text-sm font-medium mb-2">New Password</Text>
									<View
										className={`flex-row items-center bg-gray-50 border rounded-xl px-4 py-3.5 mb-1 ${
											state.passwordError !== '' ? 'border-red-400 bg-red-50' : 'border-gray-200'
										}`}
									>
										<MaterialCommunityIcons
											name="lock-outline"
											size={18}
											color={state.passwordError !== '' ? '#F87171' : '#9CA3AF'}
											style={{ marginRight: 10 }}
										/>
										<TextInput
											className="flex-1 text-gray-800 text-sm"
											placeholder="Minimum 8 characters"
											placeholderTextColor="#9CA3AF"
											value={state.password}
											onChangeText={handlePasswordChange}
											onBlur={() =>
											setState((prev) => ({ ...prev, passwordError: validatePassword(prev.password) }))
											}
											secureTextEntry={!state.showPassword}
											autoCapitalize="none"
											autoCorrect={false}
											accessibilityLabel="New password"
											{...(Platform.OS === 'web' ? { autoComplete: 'new-password' } : {})}
										/>
										<TouchableOpacity onPress={handleTogglePassword} className="p-0.5">
											<MaterialCommunityIcons
												name={state.showPassword ? 'eye-off-outline' : 'eye-outline'}
												size={18}
												color="#9CA3AF"
											/>
										</TouchableOpacity>
									</View>
									{state.passwordError !== '' && (
										<View className="flex-row items-center mb-3 ml-1">
											<MaterialCommunityIcons
												name="alert-circle-outline"
												size={13}
												color="#DC2626"
												style={{ marginRight: 4 }}
											/>
											<Text className="text-red-600 text-xs flex-1" accessibilityRole="alert">
												{state.passwordError}
											</Text>
										</View>
									)}

									<Text className="text-gray-700 text-sm font-medium mb-2 mt-2">
										Confirm Password
									</Text>
									<View
										className={`flex-row items-center bg-gray-50 border rounded-xl px-4 py-3.5 mb-1 ${
											state.confirmError !== '' ? 'border-red-400 bg-red-50' : 'border-gray-200'
										}`}
									>
										<MaterialCommunityIcons
											name="lock-check-outline"
											size={18}
											color={state.confirmError !== '' ? '#F87171' : '#9CA3AF'}
											style={{ marginRight: 10 }}
										/>
										<TextInput
											className="flex-1 text-gray-800 text-sm"
											placeholder="Re-enter your password"
											placeholderTextColor="#9CA3AF"
											value={state.confirmPassword}
											onChangeText={handleConfirmChange}
											onBlur={() =>
											setState((prev) => ({...prev, confirmError: validateConfirmPassword(prev.password, prev.confirmPassword),}))
											}
											secureTextEntry={!state.showConfirm}
											autoCapitalize="none"
											autoCorrect={false}
											accessibilityLabel="Confirm password"
											{...(Platform.OS === 'web' ? { autoComplete: 'new-password' } : {})}
										/>
										<TouchableOpacity onPress={handleToggleConfirm} className="p-0.5">
											<MaterialCommunityIcons
												name={state.showConfirm ? 'eye-off-outline' : 'eye-outline'}
												size={18}
												color="#9CA3AF"
											/>
										</TouchableOpacity>
									</View>
									{state.confirmError !== '' && (
										<View className="flex-row items-center ml-1">
											<MaterialCommunityIcons
												name="alert-circle-outline"
												size={13}
												color="#DC2626"
												style={{ marginRight: 4 }}
											/>
											<Text className="text-red-600 text-xs flex-1" accessibilityRole="alert">
												{state.confirmError}
											</Text>
										</View>
									)}
								</View>

								{state.submitError !== '' && (
									<View className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex-row items-start">
										<MaterialCommunityIcons
											name="alert-circle-outline"
											size={18}
											color="#DC2626"
											style={{ marginRight: 8, marginTop: 1 }}
										/>
										<Text className="text-red-600 text-sm flex-1">{state.submitError}</Text>
									</View>
								)}

								<TouchableOpacity
									className={`rounded-2xl py-4 items-center shadow-md ${
										isFormReady
											? 'bg-blue-600 shadow-blue-300'
											: 'bg-gray-300 shadow-gray-200'
									}`}
									onPress={handleSubmit}
									disabled={!isFormReady}
									style={webCursorStyle as object}
									accessibilityRole="button"
									accessibilityLabel="Set password"
								>
									{state.isSubmitting ? (
										<ActivityIndicator color="#fff" />
									) : (
										<Text className={`text-base font-semibold tracking-wide ${
											isFormReady ? 'text-white' : 'text-gray-400'
										}`}>
											Set Password
										</Text>
									)}
								</TouchableOpacity>
							</>
						)}

						{/* ── Success phase ── */}
						{state.phase === 'success' && (
							<View className="items-center py-16 px-4">
								<View className="w-16 h-16 bg-emerald-100 rounded-2xl items-center justify-center mb-4">
									<MaterialCommunityIcons
										name="check-circle-outline"
										size={32}
										color="#059669"
									/>
								</View>
								<Text className="text-gray-900 text-xl font-bold text-center mb-2">
									Account Ready
								</Text>
								<Text className="text-gray-500 text-sm text-center leading-5">
									Your password has been set. You may now close the browser.
								</Text>
							</View>
						)}

					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</View>
	)
}