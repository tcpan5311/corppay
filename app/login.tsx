import { useAuth } from '@/context/auth_context'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import {
  validateLoginEmail,
  validateLoginPassword
} from '../corppay-backend/src/validation/loginValidation'

const API_BASE = process.env.EXPO_PUBLIC_API_URL

// ─── Types ────────────────────────────────────────────────────────────────────

type LoginPhase = 'email' | 'company_select' | 'password'

type AdminCompanyOption =
{
	companyId:   string
	companyName: string
}

type LookupCompaniesResponse =
{
	found:     boolean
	companies: AdminCompanyOption[]
}

// Creates a fully initialized AdminCompanyOption with empty string defaults.
function createAdminCompanyOption(): AdminCompanyOption
{
	return { companyId: '', companyName: '' }
}

// Creates a fully initialized LookupCompaniesResponse defaulting to not found with an empty list.
function createLookupCompaniesResponse(): LookupCompaniesResponse
{
	return { found: false, companies: [] }
}

// ─── API ──────────────────────────────────────────────────────────────────────

// Calls the lookup endpoint and returns the list of companies associated with the given admin email.
async function fetchAdminCompanyLookup(email: string): Promise<LookupCompaniesResponse>
{
	const result   = createLookupCompaniesResponse()
	const response = await fetch(`${API_BASE}/auth/lookup`, {
		method:  'POST',
		headers: { 'Content-Type': 'application/json' },
		body:    JSON.stringify({ email }),
	})
	const data = await response.json() as Record<string, unknown>

	if (!response.ok) return result

	const rawList = data['companies']
	if (!Array.isArray(rawList)) return result

	result.found     = true
	result.companies = rawList as AdminCompanyOption[]
	return result
}

// Calls the user lookup endpoint and returns the list of companies the given user email holds a membership in.
async function fetchUserCompanyLookup(email: string): Promise<LookupCompaniesResponse>
{
	const result   = createLookupCompaniesResponse()
	const response = await fetch(`${API_BASE}/auth/lookup-user`, {
		method:  'POST',
		headers: { 'Content-Type': 'application/json' },
		body:    JSON.stringify({ email }),
	})
	const data = await response.json() as Record<string, unknown>

	if (!response.ok) return result

	const rawList = data['companies']
	if (!Array.isArray(rawList)) return result

	result.found     = true
	result.companies = rawList as AdminCompanyOption[]
	return result
}

export default function LoginScreen()
{
	const { login }                         = useAuth()
	const router                            = useRouter()
	const [activeTab, setActiveTab]         = useState<'user' | 'admin'>('user')
	const [email, setEmail]                 = useState('')
	const [password, setPassword]           = useState('')
	const [showPassword, setShowPassword]   = useState(false)
	const [isSubmitting, setIsSubmitting]   = useState(false)
	const [emailTouched, setEmailTouched]       = useState(false)
	const [passwordTouched, setPasswordTouched] = useState(false)
	const [submitError, setSubmitError]         = useState('')

	const emailValidation    = validateLoginEmail(email)
	const passwordValidation = validateLoginPassword(password)

	const emailError    = emailTouched    && emailValidation    !== null ? emailValidation    : ''
	const passwordError = passwordTouched && passwordValidation !== null ? passwordValidation : ''

	const [loginPhase,          setLoginPhase]          = useState<LoginPhase>('email')
	const [companies,           setCompanies]           = useState<AdminCompanyOption[]>([])
	const [selectedCompanyId,   setSelectedCompanyId]   = useState<string>('')
	const [selectedCompanyName, setSelectedCompanyName] = useState<string>('')
	const [isLookingUp,         setIsLookingUp]         = useState<boolean>(false)
	const [lookupError,         setLookupError]         = useState<string>('')

	const isEmailContinueReady = emailValidation    === null && !isLookingUp

	const isPasswordReady = (
		passwordValidation === null &&
		!isSubmitting &&
		selectedCompanyId !== ''
	)

	async function handleLogin(): Promise<void>
	{
		setSubmitError('')
		setIsSubmitting(true)

		try
		{
			await login(email, password, activeTab, selectedCompanyId)
			router.replace('/' as never)
		}
		catch (err: unknown)
		{
			const message = err !== null && typeof err === 'object' && 'message' in err
				? String((err as Record<string, unknown>)['message'])
				: 'Login failed. Please try again.'
			setSubmitError(message)
		}
		finally
		{
			setIsSubmitting(false)
		}
	}

	const tabButtonBase =
		"flex-1 flex-row items-center justify-center py-2.5 rounded-full"

	const activeTabStyle = {
		backgroundColor: 'white'
	}

	const inactiveTabStyle = {
		backgroundColor: 'transparent'
	}

	const activeText = "text-sm font-medium text-gray-800"
	const inactiveText = "text-sm font-medium text-gray-400"

	// Resets the login phase and company state when the user switches between tabs.
	const handleTabSwitch = (tab: 'user' | 'admin') =>
	{
		setActiveTab(tab)
		setLoginPhase('email')
		setCompanies([])
		setSelectedCompanyId('')
		setSelectedCompanyName('')
		setLookupError('')
		setSubmitError('')
		setEmail('')
		setPassword('')
		setEmailTouched(false)
		setPasswordTouched(false)
	}

	// Selects a company and moves to the password phase.
	const handleSelectCompany = (companyId: string, companyName: string) =>
	{
		setSelectedCompanyId(companyId)
		setSelectedCompanyName(companyName)
	}

	// Validates the email, performs an admin company lookup if needed, then advances to the next phase.
	async function handleEmailContinue(): Promise<void>
	{
		setEmailTouched(true)
		if (validateLoginEmail(email) !== null) return

		setIsLookingUp(true)
		setLookupError('')

		try
		{
			const result = activeTab === 'admin'
				? await fetchAdminCompanyLookup(email)
				: await fetchUserCompanyLookup(email)

			if (!result.found || result.companies.length === 0)
			{
				setLookupError(
					activeTab === 'admin'
						? 'No admin account found for this email address.'
						: 'No user account found for this email address.'
				)
				return
			}

			if (result.companies.length === 1)
			{
				setSelectedCompanyId(result.companies[0].companyId)
				setSelectedCompanyName(result.companies[0].companyName)
				setLoginPhase('password')
				return
			}

			setCompanies(result.companies)
			setLoginPhase('company_select')
		}
		catch (err: unknown)
		{
			const message = err !== null && typeof err === 'object' && 'message' in err
				? String((err as Record<string, unknown>)['message'])
				: 'Lookup failed. Please try again.'
			setLookupError(message)
		}
		finally
		{
			setIsLookingUp(false)
		}
	}

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
				>
					{/* HEADER */}
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
							Welcome Back
						</Text>
						<Text className="text-blue-200 text-sm">
							Sign in to continue to your account
						</Text>
					</View>

					{/* BODY */}
					<View className="flex-1 px-6 pt-8 pb-6">

						{/* TAB SWITCHER — only visible in email phase */}
						{loginPhase === 'email' && (
							<View className="flex-row bg-gray-100 rounded-full p-1 mb-8">
								<TouchableOpacity
									style={activeTab === 'user' ? activeTabStyle : inactiveTabStyle}
									className={tabButtonBase}
									onPress={() => handleTabSwitch('user')}
								>
									<MaterialCommunityIcons
										name="account-outline"
										size={18}
										color={activeTab === 'user' ? '#374151' : '#9CA3AF'}
										style={{ marginRight: 6 }}
									/>
									<Text className={activeTab === 'user' ? activeText : inactiveText}>User</Text>
								</TouchableOpacity>

								<TouchableOpacity
									style={activeTab === 'admin' ? activeTabStyle : inactiveTabStyle}
									className={tabButtonBase}
									onPress={() => handleTabSwitch('admin')}
								>
									<MaterialCommunityIcons
										name="shield-account-outline"
										size={18}
										color={activeTab === 'admin' ? '#374151' : '#9CA3AF'}
										style={{ marginRight: 6 }}
									/>
									<Text className={activeTab === 'admin' ? activeText : inactiveText}>Admin</Text>
								</TouchableOpacity>
							</View>
						)}

						{/* ── EMAIL PHASE ── */}
						{loginPhase === 'email' && (
							<>
								<View className="mb-5">
									<Text className="text-gray-700 text-sm font-medium mb-2">Email Address</Text>
									<View className={`flex-row items-center bg-gray-50 border rounded-xl px-4 py-3.5 ${
										emailError !== '' ? 'border-red-400 bg-red-50' : 'border-gray-200'
									}`}>
										<TextInput
											className="flex-1 text-gray-800 text-sm"
											placeholder="Enter your email"
											placeholderTextColor="#9CA3AF"
											value={email}
											onChangeText={(v) => { setEmail(v); if (emailTouched) setEmailTouched(true) }}
											onBlur={() => setEmailTouched(true)}
											keyboardType="email-address"
											autoCapitalize="none"
											autoCorrect={false}
										/>
									</View>
									{emailError !== '' && (
										<View className="flex-row items-center mt-1 ml-1">
											<MaterialCommunityIcons name="alert-circle-outline" size={13} color="#DC2626" style={{ marginRight: 4 }} />
											<Text className="text-red-600 text-xs flex-1" accessibilityRole="alert">{emailError}</Text>
										</View>
									)}
								</View>

								{lookupError !== '' && (
									<View className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex-row items-start">
										<MaterialCommunityIcons name="alert-circle-outline" size={18} color="#DC2626" style={{ marginRight: 8, marginTop: 1 }} />
										<Text className="text-red-600 text-sm flex-1">{lookupError}</Text>
									</View>
								)}

								<TouchableOpacity
									className={`rounded-2xl py-4 items-center mb-6 shadow-md ${
										isEmailContinueReady ? 'bg-blue-600 shadow-blue-300' : 'bg-gray-300 shadow-gray-200'
									}`}
									onPress={handleEmailContinue}
									disabled={!isEmailContinueReady}
								>
									{isLookingUp
										? <ActivityIndicator color="#fff" />
										: <Text className={`text-base font-semibold tracking-wide ${isEmailContinueReady ? 'text-white' : 'text-gray-400'}`}>Continue</Text>
									}
								</TouchableOpacity>

								<View className="flex-row justify-center">
									<Text className="text-gray-500 text-sm">Don't have an account? </Text>
									<TouchableOpacity onPress={() => router.push('/register-select' as never)}>
										<Text className="text-blue-600 text-sm font-semibold">Sign Up</Text>
									</TouchableOpacity>
								</View>
							</>
						)}

						{/* ── COMPANY SELECT PHASE (user and admin) ── */}
						{loginPhase === 'company_select' && (
							<>
								<View className="mb-5 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl flex-row items-center">
									<MaterialCommunityIcons name="email-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
									<Text className="text-gray-600 text-sm flex-1" numberOfLines={1}>{email}</Text>
								</View>

								<Text className="text-gray-700 text-sm font-medium mb-3">Select Company</Text>

								{companies.map((company) => (
									<TouchableOpacity
										key={company.companyId}
										onPress={() => handleSelectCompany(company.companyId, company.companyName)}
										className={`border rounded-xl px-4 py-3.5 mb-2 flex-row items-center ${
											selectedCompanyId === company.companyId
												? 'border-blue-500 bg-blue-50'
												: 'border-gray-200 bg-gray-50'
										}`}
									>
										<MaterialCommunityIcons
											name="office-building-outline"
											size={18}
											color={selectedCompanyId === company.companyId ? '#2563EB' : '#9CA3AF'}
											style={{ marginRight: 10 }}
										/>
										<Text className={`flex-1 text-sm font-medium ${
											selectedCompanyId === company.companyId ? 'text-blue-700' : 'text-gray-700'
										}`}>
											{company.companyName}
										</Text>
										{selectedCompanyId === company.companyId && (
											<MaterialCommunityIcons name="check-circle" size={18} color="#2563EB" />
										)}
									</TouchableOpacity>
								))}

								<TouchableOpacity
									className={`rounded-2xl py-4 items-center mt-4 mb-3 shadow-md ${
										selectedCompanyId !== '' ? 'bg-blue-600 shadow-blue-300' : 'bg-gray-300 shadow-gray-200'
									}`}
									onPress={() => { if (selectedCompanyId !== '') setLoginPhase('password') }}
									disabled={selectedCompanyId === ''}
								>
									<Text className={`text-base font-semibold tracking-wide ${selectedCompanyId !== '' ? 'text-white' : 'text-gray-400'}`}>
										Continue
									</Text>
								</TouchableOpacity>

								<TouchableOpacity className="items-center py-2" onPress={() => setLoginPhase('email')}>
									<Text className="text-gray-500 text-sm">Back</Text>
								</TouchableOpacity>
							</>
						)}

						{/* ── PASSWORD PHASE ── */}
						{loginPhase === 'password' && (
							<>
								<View className="mb-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl flex-row items-center">
									<MaterialCommunityIcons name="email-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
									<Text className="text-gray-600 text-sm flex-1" numberOfLines={1}>{email}</Text>
								</View>

								{selectedCompanyName !== '' && (
									<View className="mb-4 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl flex-row items-center">
										<MaterialCommunityIcons name="office-building-outline" size={16} color="#2563EB" style={{ marginRight: 8 }} />
										<Text className="text-blue-700 text-sm flex-1 font-medium" numberOfLines={1}>{selectedCompanyName}</Text>
									</View>
								)}

								<View className="mb-3">
									<Text className="text-gray-700 text-sm font-medium mb-2">Password</Text>
									<View className={`flex-row items-center bg-gray-50 border rounded-xl px-4 py-3.5 ${
										passwordError !== '' ? 'border-red-400 bg-red-50' : 'border-gray-200'
									}`}>
										<TextInput
											className="flex-1 text-gray-800 text-sm"
											placeholder="Enter your password"
											placeholderTextColor="#9CA3AF"
											value={password}
											onChangeText={(v) => { setPassword(v); if (passwordTouched) setPasswordTouched(true) }}
											onBlur={() => setPasswordTouched(true)}
											secureTextEntry={!showPassword}
											autoCapitalize="none"
											autoCorrect={false}
										/>
										<TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
											<MaterialCommunityIcons
												name={showPassword ? 'eye-off-outline' : 'eye-outline'}
												size={20}
												color="#9CA3AF"
											/>
										</TouchableOpacity>
									</View>
									{passwordError !== '' && (
										<View className="flex-row items-center mt-1 ml-1">
											<MaterialCommunityIcons name="alert-circle-outline" size={13} color="#DC2626" style={{ marginRight: 4 }} />
											<Text className="text-red-600 text-xs flex-1" accessibilityRole="alert">{passwordError}</Text>
										</View>
									)}
								</View>

								{submitError !== '' && (
									<View className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex-row items-start">
										<MaterialCommunityIcons name="alert-circle-outline" size={18} color="#DC2626" style={{ marginRight: 8, marginTop: 1 }} />
										<Text className="text-red-600 text-sm flex-1">{submitError}</Text>
									</View>
								)}

								<View className="items-end mb-8">
									<TouchableOpacity>
										<Text className="text-blue-600 text-sm font-medium">Forgot Password?</Text>
									</TouchableOpacity>
								</View>

								<TouchableOpacity
									className={`rounded-2xl py-4 items-center mb-4 shadow-md ${
										isPasswordReady ? 'bg-blue-600 shadow-blue-300' : 'bg-gray-300 shadow-gray-200'
									}`}
									onPress={handleLogin}
									disabled={!isPasswordReady}
								>
									{isSubmitting
										? <ActivityIndicator color="#fff" />
										: <Text className={`text-base font-semibold tracking-wide ${isPasswordReady ? 'text-white' : 'text-gray-400'}`}>Sign In</Text>
									}
								</TouchableOpacity>

								<TouchableOpacity className="items-center py-2" onPress={() =>
								{
									setLoginPhase(companies.length > 1 ? 'company_select' : 'email')
									setSubmitError('')
									setPassword('')
									setPasswordTouched(false)
								}}>
									<Text className="text-gray-500 text-sm">Back</Text>
								</TouchableOpacity>
							</>
						)}

					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</View>
	)
}