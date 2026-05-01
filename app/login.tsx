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

export default function LoginScreen()
{
  const { login }                         = useAuth()
  const router                            = useRouter()
  const [activeTab, setActiveTab]         = useState<'user' | 'admin'>('user')
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [showPassword, setShowPassword]   = useState(false)
  const [isSubmitting, setIsSubmitting]   = useState(false)
  const [errorMessage, setErrorMessage]   = useState<string | null>(null)

  async function handleLogin()
  {
    if (!email || !password) 
    {
      setErrorMessage('Please enter your email and password.')
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)

    try
    {
      await login(email, password, activeTab)
      router.replace('/' as any)
    }
    catch (err: any)
    {
      setErrorMessage(err?.message ?? 'Login failed. Please try again.')
    }
    finally
    {
      setIsSubmitting(false)
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

            {/* TAB SWITCHER */}
            <View className="flex-row bg-gray-100 rounded-full p-1 mb-8">

              <TouchableOpacity
                className={`flex-1 flex-row items-center justify-center py-2.5 rounded-full ${
                  activeTab === 'user' ? 'bg-white shadow-sm' : 'bg-transparent'
                }`}
                onPress={() => setActiveTab('user')}
              >
                <MaterialCommunityIcons
                  name="account-outline"
                  size={18}
                  color={activeTab === 'user' ? '#374151' : '#9CA3AF'}
                  style={{ marginRight: 6 }}
                />
                <Text className={`text-sm font-medium ${activeTab === 'user' ? 'text-gray-800' : 'text-gray-400'}`}>
                  User
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-1 flex-row items-center justify-center py-2.5 rounded-full ${
                  activeTab === 'admin' ? 'bg-white shadow-sm' : 'bg-transparent'
                }`}
                onPress={() => setActiveTab('admin')}
              >
                <MaterialCommunityIcons
                  name="shield-account-outline"
                  size={18}
                  color={activeTab === 'admin' ? '#374151' : '#9CA3AF'}
                  style={{ marginRight: 6 }}
                />
                <Text className={`text-sm font-medium ${activeTab === 'admin' ? 'text-gray-800' : 'text-gray-400'}`}>
                  Admin
                </Text>
              </TouchableOpacity>
            </View>

            {/* EMAIL */}
            <View className="mb-5">
              <Text className="text-gray-700 text-sm font-medium mb-2">
                Email Address
              </Text>
              <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5">
                <TextInput
                  className="flex-1 text-gray-800 text-sm"
                  placeholder="Enter your email"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* PASSWORD */}
            <View className="mb-3">
              <Text className="text-gray-700 text-sm font-medium mb-2">
                Password
              </Text>
              <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5">
                <TextInput
                  className="flex-1 text-gray-800 text-sm"
                  placeholder="Enter your password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
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
            </View>

            {/* ERROR MESSAGE */}
            {errorMessage && (
              <View className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                <Text className="text-red-600 text-sm">{errorMessage}</Text>
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
              className="bg-blue-600 rounded-2xl py-4 items-center mb-6 shadow-md shadow-blue-300"
              onPress={handleLogin}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? <ActivityIndicator color="#fff" />
                : <Text className="text-white text-base font-semibold tracking-wide">Sign In</Text>
              }
            </TouchableOpacity>

            {/* SIGN UP */}
            <View className="flex-row justify-center">
              <Text className="text-gray-500 text-sm">Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/register_select' as any)}>
                <Text className="text-blue-600 text-sm font-semibold">Sign Up</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}