"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"

export interface LoginPayload {
  email: string
  password: string
}

export interface AuthTokens {
  access: string
  refresh: string
  is_first_login?: boolean
}

export function useAuth() {
  const router = useRouter()

  const login = useCallback(
    async (payload: LoginPayload): Promise<AuthTokens> => {
      const data = await api.post<AuthTokens>("/api/accounts/login/", payload)
      localStorage.setItem("access_token", data.access)
      localStorage.setItem("refresh_token", data.refresh)
      return data
    },
    [],
  )

  const logout = useCallback(() => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    document.cookie = "has_token=; path=/; max-age=0"
    router.push("/login")
  }, [router])

  const isLoggedIn = useCallback((): boolean => {
    if (typeof window === "undefined") return false
    return !!localStorage.getItem("access_token")
  }, [])

  return { login, logout, isLoggedIn }
}
