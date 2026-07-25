import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import type { AuthUser } from "../types"
import { api } from "../api/client"

interface AuthContextValue {
  user: AuthUser | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("airportos_user")
    return raw ? JSON.parse(raw) : null
  })

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password)
    const u: AuthUser = { username: res.username, full_name: res.full_name, role: res.role, token: res.access_token }
    localStorage.setItem("airportos_token", res.access_token)
    localStorage.setItem("airportos_user", JSON.stringify(u))
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("airportos_token")
    localStorage.removeItem("airportos_user")
    setUser(null)
  }, [])

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
