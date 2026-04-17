"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { isAxiosError } from "axios"
import api from "@/shared/api/axios"
import { User } from "@/types/auth"
import type { ApiResponse } from "@/shared/api/types"
import {
  clearAuthSession,
  hasAuthSessionHint,
  persistAuthSession,
  setStoredAuthUser,
} from "@/shared/auth/session"
import { redirectToLogin } from "@/shared/auth/redirect-policy"
import {
  FRONTEND_HEAD_SCOPE_BASE_PATH,
} from "@/shared/utils/role-label"

type LoginCredentials = {
  citizen_id: string
  password: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)
type AuthUserPayload = Omit<User, "head_scope_roles"> & {
  head_scope_roles?: string[]
}

function normalizeHeadScopeRoles(
  headScopeRoles?: AuthUserPayload["head_scope_roles"],
): User["head_scope_roles"] {
  if (!headScopeRoles?.length) return undefined
  const normalized = headScopeRoles
    .map((role) => {
      if (role === "WARD_SCOPE") return "WARD_SCOPE"
      if (role === "DEPT_SCOPE") return "DEPT_SCOPE"
      return null
    })
    .filter((role): role is NonNullable<User["head_scope_roles"]>[number] => role !== null)

  return normalized.length > 0 ? normalized : undefined
}

function normalizeUser(user: AuthUserPayload): User {
  return {
    ...user,
    head_scope_roles: normalizeHeadScopeRoles(user.head_scope_roles),
  }
}

function getRoleHomePath(role: User["role"]): string {
  switch (role) {
    case "USER":
      return "/user"
    case "HEAD_SCOPE":
      return FRONTEND_HEAD_SCOPE_BASE_PATH
    case "PTS_OFFICER":
      return "/pts-officer"
    case "DIRECTOR":
      return "/director"
    case "HEAD_HR":
      return "/head-hr"
    case "HEAD_FINANCE":
      return "/head-finance"
    case "FINANCE_OFFICER":
      return "/finance-officer"
    case "ADMIN":
      return "/admin"
    default:
      return "/"
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const finalizeLogout = React.useCallback(() => {
    clearAuthSession()
    setUser(null)
    redirectToLogin({ pathname, navigate: (target) => router.push(target) })
  }, [pathname, router])

  const logout = React.useCallback(() => {
    void api.post("/auth/logout").catch(() => null).finally(() => {
      finalizeLogout()
    })
  }, [finalizeLogout])

  const refreshCurrentUser = React.useCallback(async () => {
    const { data } = await api.get<ApiResponse<AuthUserPayload>>("/auth/me")
    if (!data.success || !data.data) {
      throw new Error("Failed to fetch user")
    }

    const normalizedUser = normalizeUser(data.data)
    setUser(normalizedUser)
    setStoredAuthUser(normalizedUser)
    return normalizedUser
  }, [])

  const isExpectedAuthRefreshError = React.useCallback((error: unknown): boolean => {
    if (!isAxiosError(error)) return false
    const status = error.response?.status
    return status === 401 || status === 404
  }, [])

  // 1. Check User on Mount
  React.useEffect(() => {
    const initAuth = async () => {
      try {
        await refreshCurrentUser()
      } catch (error) {
        if (!isExpectedAuthRefreshError(error)) {
          console.error("Failed to initialize auth:", error)
        }
        finalizeLogout()
      } finally {
        setIsLoading(false)
      }
    }

    void initAuth()
  }, [finalizeLogout, isExpectedAuthRefreshError, refreshCurrentUser])

  // 2. Refresh user on tab focus / visibility to detect role changes from backend.
  React.useEffect(() => {
    const shouldSkip = isLoading || !user || !hasAuthSessionHint()
    if (shouldSkip) return

    const syncUser = async () => {
      try {
        await refreshCurrentUser()
      } catch {
        logout()
      }
    }

    const onFocus = () => {
      void syncUser()
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncUser()
      }
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [isLoading, logout, refreshCurrentUser, user])

  // 3. Enforce route by current role so layout/sidebar always match active user.
  React.useEffect(() => {
    if (isLoading || !user) return
    const roleHome = getRoleHomePath(user.role)
    if (pathname === "/login") {
      router.replace(roleHome)
      return
    }
    if (pathname !== roleHome && !pathname.startsWith(`${roleHome}/`)) {
      router.replace(roleHome)
    }
  }, [isLoading, pathname, router, user])

  // 4. Login Function
  const login = async (credentials: LoginCredentials) => {
    // credentials should contain { citizen_id, password }
    const { data } = await api.post<ApiResponse<{ user: AuthUserPayload }>>("/auth/login", credentials)

    // Backend returns { success, user } and sets HttpOnly auth cookie.
    if (data.success) {
      const user = (data as unknown as { user?: AuthUserPayload }).user ?? data.data?.user
      if (!user) {
        throw new Error("Login response missing user")
      }

      const normalizedUser = normalizeUser(user)
      persistAuthSession("", normalizedUser)

      setUser(normalizedUser)

      // Redirect based on current role
      router.push(getRoleHomePath(normalizedUser.role))
    } else {
      throw new Error(data.error || "Login failed")
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook for usage
export function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
