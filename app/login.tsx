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

  const emailError    = emailTouched    ? validateLoginEmail(email)       ?? '' : ''
  const passwordError = passwordTouched ? validateLoginPassword(password) ?? '' : ''

  const isFormReady = (
	  validateLoginEmail(email)    === null &&
	  validateLoginPassword(password) === null &&
	  !isSubmitting
  )

  async function handleLogin(): Promise<void>
  {
    setSubmitError('')
    setIsSubmitting(true)

    try
    {
      await login(email, password, activeTab)
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

            {/* TAB SWITCHER */}
            <View className="flex-row bg-gray-100 rounded-full p-1 mb-8">

              {/* USER TAB */}
              <TouchableOpacity
                style={activeTab === 'user' ? activeTabStyle : inactiveTabStyle}
                className={tabButtonBase}
                onPress={() => setActiveTab('user')}
              >
                <MaterialCommunityIcons
                  name="account-outline"
                  size={18}
                  color={activeTab === 'user' ? '#374151' : '#9CA3AF'}
                  style={{ marginRight: 6 }}
                />
                <Text className={activeTab === 'user' ? activeText : inactiveText}>
                  User
                </Text>
              </TouchableOpacity>

              {/* ADMIN TAB */}
              <TouchableOpacity
                style={activeTab === 'admin' ? activeTabStyle : inactiveTabStyle}
                className={tabButtonBase}
                onPress={() => setActiveTab('admin')}
              >
                <MaterialCommunityIcons
                  name="shield-account-outline"
                  size={18}
                  color={activeTab === 'admin' ? '#374151' : '#9CA3AF'}
                  style={{ marginRight: 6 }}
                />
                <Text className={activeTab === 'admin' ? activeText : inactiveText}>
                  Admin
                </Text>
              </TouchableOpacity>

            </View>

            {/* EMAIL */}
            <View className="mb-5">
              <Text className="text-gray-700 text-sm font-medium mb-2">
                Email Address
              </Text>
              <View className={`flex-row items-center bg-gray-50 border rounded-xl px-4 py-3.5 ${
                emailError !== '' ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}>
                <TextInput
                  className="flex-1 text-gray-800 text-sm"
                  placeholder="Enter your email"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={(v) =>
                  {
                    setEmail(v)
                    if (emailTouched) setEmailTouched(true)
                  }}
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

            {/* PASSWORD */}
            <View className="mb-3">
              <Text className="text-gray-700 text-sm font-medium mb-2">
                Password
              </Text>
              <View className={`flex-row items-center bg-gray-50 border rounded-xl px-4 py-3.5 ${
                passwordError !== '' ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}>
                <TextInput
                  className="flex-1 text-gray-800 text-sm"
                  placeholder="Enter your password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={(v) =>
                  {
                    setPassword(v)
                    if (passwordTouched) setPasswordTouched(true)
                  }}
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

            {/* SUBMIT ERROR */}
            {submitError !== '' && (
              <View className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex-row items-start">
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#DC2626" style={{ marginRight: 8, marginTop: 1 }} />
                <Text className="text-red-600 text-sm flex-1">{submitError}</Text>
              </View>
            )}

            {/* FORGOT */}
            <View className="items-end mb-8">
              <TouchableOpacity>
                <Text className="text-blue-600 text-sm font-medium">
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            {/* SIGN IN */}
            <TouchableOpacity
              className={`rounded-2xl py-4 items-center mb-6 shadow-md ${
                isFormReady ? 'bg-blue-600 shadow-blue-300' : 'bg-gray-300 shadow-gray-200'
              }`}
              onPress={handleLogin}
              disabled={!isFormReady}
            >
              {isSubmitting
                ? <ActivityIndicator color="#fff" />
                : <Text className={`text-base font-semibold tracking-wide ${
                  isFormReady ? 'text-white' : 'text-gray-400'
                }`}>Sign In</Text>
              }
            </TouchableOpacity>

            {/* SIGN UP */}
            <View className="flex-row justify-center">
              <Text className="text-gray-500 text-sm">Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/register-select' as never)}>
                <Text className="text-blue-600 text-sm font-semibold">Sign Up</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}