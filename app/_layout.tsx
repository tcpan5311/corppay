import FooterBar from '@/components/footer_bar'
import HeaderBar from '@/components/header_components'
import { AuthProvider, useAuth } from '@/context/auth_context'
import { Stack, useRouter, useSegments } from 'expo-router'
import React, { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Provider as PaperProvider } from 'react-native-paper'

function AuthGuard({ children }: { children: React.ReactNode })
{
  const { user, isLoading } = useAuth()
  const router              = useRouter()
  const segments            = useSegments()

  useEffect(() =>
  {
    if (isLoading) return

    const PUBLIC_ROUTES = ['login', 'register-select', 'register-business', 'admin', 'resubmit']
    const inAuthGroup = PUBLIC_ROUTES.includes(segments[0] as string)

    if (!user && !inAuthGroup)
    {
      router.replace('/login' as any)
    }
    else if (user && inAuthGroup)
    {
      router.replace('/' as any)
    }
  }, [user, isLoading, segments])

  if (isLoading)
  {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#2B4EFF" />
      </View>
    )
  }

  return <>{children}</>
}

function AppLayout()
{
  const { user } = useAuth()

  return (
    <View className="flex-1 bg-[#e0e0e0] items-center justify-center">
      <View className="flex-1 w-full bg-white overflow-hidden web:w-[390px] web:h-[844px] web:max-h-screen web:shadow-[0px_0px_20px_rgba(0,0,0,0.15)] web:rounded-[40px]">
        {user && <HeaderBar />}
        <View className="flex-1">
          <Stack screenOptions={{ headerShown: false }} />
        </View>
        {user && <FooterBar />}
      </View>
    </View>
  )
}

export default function RootLayout()
{
  return (
    <PaperProvider>
      <AuthProvider>
        <AuthGuard>
          <AppLayout />
        </AuthGuard>
      </AuthProvider>
    </PaperProvider>
  )
}