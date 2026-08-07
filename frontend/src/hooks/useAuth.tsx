'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'

import { api, clearToken, getToken, setToken } from '@/lib/api'
import type { TokenResponse, User } from '@/lib/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName?: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await api.get<User>('/auth/me')
      setUser(me)
    } catch {
      clearToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    if (!getToken()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- finishing the session check
      setLoading(false)
      return
    }
    api
      .get<User>('/auth/me')
      .then((me) => {
        if (active) setUser(me)
      })
      .catch(() => {
        if (active) {
          clearToken()
          setUser(null)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<TokenResponse>('/auth/login', { email, password })
      setToken(res.access_token)
      await refreshUser()
      router.push('/dashboard')
    },
    [refreshUser, router],
  )

  const register = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const res = await api.post<TokenResponse>('/auth/register', {
        email,
        password,
        full_name: fullName ?? null,
      })
      setToken(res.access_token)
      await refreshUser()
      router.push('/dashboard')
    },
    [refreshUser, router],
  )

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
    router.push('/')
  }, [router])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
