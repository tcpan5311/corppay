import FooterBar from '@/components/footer_bar'
import HeaderBar from '@/components/header_components'
import { AuthProvider, useAuth } from '@/context/auth_context'
import { Stack, useRouter, useSegments } from 'expo-router'
import React, { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Provider as PaperProvider } from 'react-native-paper'

const PUBLIC_ROUTES = ['login', 'register-select', 'register-business', 'admin', 'resubmit']

// Returns true when the first segment matches a known public route.
function isPublicRoute(segments: string[]): boolean
{
	return PUBLIC_ROUTES.includes(segments[0] as string)
}

// Renders a centered full-screen loading spinner.
function LoadingScreen()
{
	return (
		<View className="flex-1 justify-center items-center bg-white">
			<ActivityIndicator size="large" color="#2B4EFF" />
		</View>
	)
}

// Guards protected routes by redirecting unauthenticated users to login and blocking the index flash.
function AuthGuard({ children }: { children: React.ReactNode })
{
	const { user, isLoading } = useAuth()
	const router              = useRouter()
	const segments            = useSegments()

	useEffect(() =>
	{
		if (isLoading) return

		const inPublic = isPublicRoute(segments as string[])

		if (!user && !inPublic)
		{
			router.replace('/login' as never)
		}
		else if (user && inPublic)
		{
			router.replace('/' as never)
		}
	}, [user, isLoading, segments])

	if (isLoading)
	{
		return <LoadingScreen />
	}

	// Block protected content from rendering before the redirect fires.
	// This eliminates the index.tsx flash when the user is not authenticated.
	const inPublic = isPublicRoute(segments as string[])
	if (!user && !inPublic)
	{
		return <LoadingScreen />
	}

	return <>{children}</>
}

// Renders the app shell with conditional header and footer based on authentication state.
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

// Bootstraps the provider tree and authentication guard for the entire application.
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