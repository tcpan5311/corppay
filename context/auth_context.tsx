import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, View } from 'react-native'

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000'

type User =
{
    id: string
    email: string
    role: 'user' | 'admin'
    isActive: boolean
    lastLoginAt: string | null
}

type AuthContextType =
{
    user: User | null
    isLoading: boolean
    login: (email: string, password: string, role: 'user' | 'admin') => Promise<void>
    logout: () => Promise<void>
    getAccessToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | null>(null)

async function getRefreshToken()
{
    if (Platform.OS === 'web')
    {
        return await AsyncStorage.getItem('refreshToken')
    }
    return await SecureStore.getItemAsync('refreshToken')
}

async function setRefreshToken(token: string)
{
    if (Platform.OS === 'web')
    {
        return await AsyncStorage.setItem('refreshToken', token)
    }
    return await SecureStore.setItemAsync('refreshToken', token)
}

async function deleteRefreshToken()
{
    if (Platform.OS === 'web')
    {
        return await AsyncStorage.removeItem('refreshToken')
    }
    return await SecureStore.deleteItemAsync('refreshToken')
}

export function AuthProvider({ children }: { children: React.ReactNode })
{
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setLoading] = useState(true)
    const accessTokenRef = useRef<string | null>(null)

    useEffect(() =>
    {
        (async () =>
        {
            await silentRefresh()
            setLoading(false)
        })()
    }, [])

    async function silentRefresh()
    {
        try
        {
            const refreshToken = await getRefreshToken()

            if (!refreshToken)
            {
                setUser(null)
                return
            }

            const res = await fetch(`${API_BASE}/auth/refresh`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
            })

            if (!res.ok)
            {
                setUser(null)
                return
            }

            const { accessToken, refreshToken: newRefreshToken, user } = await res.json()

            accessTokenRef.current = accessToken
            setUser(user)

            await setRefreshToken(newRefreshToken)
        }
        catch
        {
            setUser(null)
        }
    }

    async function login(email: string, password: string, role: 'user' | 'admin')
    {
        const res = await fetch(`${API_BASE}/auth/login`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role }),
        })

        if (!res.ok)
        {
            const body = await res.json()
            throw new Error(body?.error ?? 'Login failed')
        }

        const { accessToken, refreshToken, user } = await res.json()

        accessTokenRef.current = accessToken
        setUser(user)

        await setRefreshToken(refreshToken)
    }

    async function logout()
    {
        try
        {
            const refreshToken = await getRefreshToken()

            if (refreshToken && accessTokenRef.current)
            {
                await fetch(`${API_BASE}/auth/logout`,
                {
                    method: 'POST',
                    headers:
                    {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessTokenRef.current}`,
                    },
                    body: JSON.stringify({ refreshToken }),
                })
            }
        }
        finally
        {
            accessTokenRef.current = null
            setUser(null)
            await deleteRefreshToken()
        }
    }

    const getAccessToken = useCallback(async () =>
    {
        return accessTokenRef.current
    }, [])

    if (isLoading)
    {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#2B4EFF" />
            </View>
        )
    }

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout, getAccessToken }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth()
{
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
    return ctx
}