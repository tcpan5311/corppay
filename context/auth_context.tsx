import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { Platform } from 'react-native'

const API_BASE = process.env.EXPO_PUBLIC_API_URL as string

const ACCESS_TOKEN_KEY  = 'corppay_access_token'
const REFRESH_TOKEN_KEY = 'corppay_refresh_token'

// SecureStore (Keychain/Keystore) on native; AsyncStorage on web where SecureStore is unavailable.
const useSecure = Platform.OS !== 'web'
const tokenStore = {
	get:    (key: string): Promise<string | null> => useSecure ? SecureStore.getItemAsync(key) : AsyncStorage.getItem(key),
	set:    (key: string, value: string): Promise<void> => useSecure ? SecureStore.setItemAsync(key, value) : AsyncStorage.setItem(key, value),
	remove: (key: string): Promise<void> => useSecure ? SecureStore.deleteItemAsync(key) : AsyncStorage.removeItem(key),
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'admin'

export type AuthUser =
{
	id:          string
	email:       string
	role:        string
	isActive:    boolean
	lastLoginAt: string
}

type AuthContextValue =
{
	user:        AuthUser | null
	accessToken: string
	isLoading:   boolean
	login: (email: string, password: string, role: UserRole, companyId: string) => Promise<void>
	logout:      () => Promise<void>
}

// ─── Factories ────────────────────────────────────────────────────────────────

// Creates a fully initialized AuthUser with empty/zero defaults.
function createAuthUser(): AuthUser
{
	return {
		id:          '',
		email:       '',
		role:        '',
		isActive:    false,
		lastLoginAt: new Date(0).toISOString(),
	}
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Extracts a validated AuthUser from a raw API response object, returning null when required fields are absent.
function extractAuthUser(raw: Record<string, unknown>): AuthUser | null
{
	const id          = typeof raw['id']          === 'string'  ? raw['id']          : ''
	const email       = typeof raw['email']       === 'string'  ? raw['email']       : ''
	const role        = typeof raw['role']        === 'string'  ? raw['role']        : ''
	const isActive    = typeof raw['isActive']    === 'boolean' ? raw['isActive']    : false
	const lastLoginAt = typeof raw['lastLoginAt'] === 'string'  ? raw['lastLoginAt'] : new Date(0).toISOString()

	if (id === '' || email === '' || role === '') return null

	const user          = createAuthUser()
	user.id             = id
	user.email          = email
	user.role           = role
	user.isActive       = isActive
	user.lastLoginAt    = lastLoginAt
	return user
}

// Safely resolves a user object from an unknown API response value.
function resolveRawUser(value: unknown): Record<string, unknown>
{
	if (value !== null && typeof value === 'object') return value as Record<string, unknown>
	return {}
}

// ─── Session Restore ──────────────────────────────────────────────────────────

type RestoredSession =
{
	user:        AuthUser | null
	accessToken: string
}

// Creates a fully initialized RestoredSession with null user and empty token.
function createRestoredSession(): RestoredSession
{
	return { user: null, accessToken: '' }
}

// Reads the stored refresh token and exchanges it for a new access token, returning null session on failure.
async function tryRestoreSession(): Promise<RestoredSession>
{
	const result  = createRestoredSession()
	const storedRefresh = await tokenStore.get(REFRESH_TOKEN_KEY)
	const refresh = storedRefresh === null ? '' : storedRefresh

	if (refresh === '') return result

	const response = await fetch(`${API_BASE}/auth/refresh`, {
		method:  'POST',
		headers: { 'Content-Type': 'application/json' },
		body:    JSON.stringify({ refreshToken: refresh }),
	})

	if (!response.ok)
	{
		await Promise.all([tokenStore.remove(ACCESS_TOKEN_KEY), tokenStore.remove(REFRESH_TOKEN_KEY)])
		return result
	}

	const data            = await response.json() as Record<string, unknown>
	const newAccessToken  = typeof data['accessToken']  === 'string' ? data['accessToken']  : ''
	const newRefreshToken = typeof data['refreshToken'] === 'string' ? data['refreshToken'] : ''
	const user            = extractAuthUser(resolveRawUser(data['user']))

	if (user === null || newAccessToken === '' || newRefreshToken === '') return result

	await Promise.all([
		tokenStore.set(ACCESS_TOKEN_KEY,  newAccessToken),
		tokenStore.set(REFRESH_TOKEN_KEY, newRefreshToken),
	])

	result.user        = user
	result.accessToken = newAccessToken
	return result
}

// ─── Provider ─────────────────────────────────────────────────────────────────

// Provides authentication state and login/logout actions to the component tree, restoring any persisted session on mount.
export function AuthProvider({ children }: { children: React.ReactNode })
{
	const [user, setUser]               = useState<AuthUser | null>(null)
	const [accessToken, setAccessToken] = useState<string>('')
	const [isLoading, setIsLoading]     = useState<boolean>(true)

	useEffect(() =>
	{
		async function restoreOnMount(): Promise<void>
		{
			try
			{
				const session = await tryRestoreSession()
				setUser(session.user)
				setAccessToken(session.accessToken)
			}
			catch
			{
				setUser(null)
				setAccessToken('')
			}
			finally
			{
				setIsLoading(false)
			}
		}

		restoreOnMount()
	}, [])

	// Authenticates the user against the API, including company context for admin logins, and persists tokens on success.
	async function login(email: string, password: string, role: UserRole, companyId: string): Promise<void>
	{
		const response = await fetch(`${API_BASE}/auth/login`, {
			method:  'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password, role, companyId }),
		})

		const data = await response.json() as Record<string, unknown>

		if (!response.ok)
		{
			const message = typeof data['error'] === 'string' ? data['error'] : 'Login failed.'
			throw new Error(message)
		}

		const newAccessToken  = typeof data['accessToken']  === 'string' ? data['accessToken']  : ''
		const newRefreshToken = typeof data['refreshToken'] === 'string' ? data['refreshToken'] : ''
		const loggedInUser    = extractAuthUser(resolveRawUser(data['user']))

		if (loggedInUser === null || newAccessToken === '' || newRefreshToken === '')
		{
			throw new Error('Received an invalid response from the server.')
		}

		await Promise.all([
			tokenStore.set(ACCESS_TOKEN_KEY,  newAccessToken),
			tokenStore.set(REFRESH_TOKEN_KEY, newRefreshToken),
		])

		setAccessToken(newAccessToken)
		setUser(loggedInUser)
	}

	// Clears persisted tokens and resets authentication state, attempting a server-side logout if tokens exist.
	async function logout(): Promise<void>
	{
		const stored       = await tokenStore.get(REFRESH_TOKEN_KEY)
		const refreshToken = stored !== null ? stored : ''

		if (refreshToken !== '' && accessToken !== '')
		{
			fetch(`${API_BASE}/auth/logout`, {
				method:  'POST',
				headers: {
					'Content-Type':  'application/json',
					'Authorization': `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ refreshToken }),
			}).catch((_err: unknown) => { /* server logout is best-effort */ })
		}

		await Promise.all([tokenStore.remove(ACCESS_TOKEN_KEY), tokenStore.remove(REFRESH_TOKEN_KEY)])
		setUser(null)
		setAccessToken('')
	}

	const value: AuthContextValue = { user, accessToken, isLoading, login, logout }

	return (
		<AuthContext.Provider value={value}>
			{children}
		</AuthContext.Provider>
	)
}

// Returns the authentication context value, throwing if called outside of an AuthProvider.
export function useAuth(): AuthContextValue
{
	const context = useContext(AuthContext)
	if (context === null) throw new Error('useAuth must be used within an AuthProvider.')
	return context
}