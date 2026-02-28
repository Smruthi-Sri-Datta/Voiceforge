import { createContext, useContext, useState, useEffect } from 'react'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
const TOKEN_KEY    = 'voiceforge_auth_token'
const CREDITS_KEY  = 'voiceforge_guest_credits'

const AuthContext = createContext()

function decodeToken(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch { return null }
}

function isTokenExpired(payload) {
  if (!payload?.exp) return true
  return Date.now() / 1000 > payload.exp
}

function loadCredits() {
  try {
    const saved = localStorage.getItem(CREDITS_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return { tts: 1, clone: 1 }
}

function saveCredits(credits) {
  try { localStorage.setItem(CREDITS_KEY, JSON.stringify(credits)) } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser]                       = useState(null)
  const [loading, setLoading]                 = useState(true)
  const [authModalOpen, setAuthModalOpen]     = useState(false)
  const [authModalReason, setAuthModalReason] = useState(null)
  const [guestCredits, setGuestCredits]       = useState(loadCredits)

  // ── Boot: read token from URL or localStorage ─────────────
  useEffect(() => {
    const params   = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      localStorage.setItem(TOKEN_KEY, urlToken)
      window.history.replaceState({}, document.title, window.location.pathname)
      const payload = decodeToken(urlToken)
      if (payload && !isTokenExpired(payload)) {
        setUser({ id: payload.sub, email: payload.email, name: payload.name, picture: payload.picture })
        setLoading(false)
        return
      }
    }
    const storedToken = localStorage.getItem(TOKEN_KEY)
    if (storedToken) {
      const payload = decodeToken(storedToken)
      if (payload && !isTokenExpired(payload)) {
        setUser({ id: payload.sub, email: payload.email, name: payload.name, picture: payload.picture })
      } else {
        localStorage.removeItem(TOKEN_KEY)
      }
    }
    setLoading(false)
  }, [])

  // ── Internal: store token and update user state ───────────
  function _setToken(token) {
    localStorage.setItem(TOKEN_KEY, token)
    const payload = decodeToken(token)
    if (payload) {
      setUser({ id: payload.sub, email: payload.email, name: payload.name, picture: payload.picture })
    }
  }

  function getToken() { return localStorage.getItem(TOKEN_KEY) }

  async function authFetch(url, options = {}) {
    const token   = getToken()
    const headers = { ...(options.headers || {}) }
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
    return fetch(url, { ...options, headers })
  }

  // ── Google OAuth ──────────────────────────────────────────
  function loginWithGoogle() {
    window.location.href = `${BACKEND}/api/auth/google`
  }

  // ── Email: Register ───────────────────────────────────────
  async function emailRegister(name, email, password) {
    const res  = await fetch(`${BACKEND}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Registration failed.')
    return data   // { message, requires_otp: true }
  }

  // ── Email: Login ──────────────────────────────────────────
  async function emailLogin(email, password) {
    const res  = await fetch(`${BACKEND}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      const err    = new Error(data.detail || 'Login failed.')
      err.status   = res.status
      throw err
    }
    _setToken(data.token)
    closeAuthModal()
    return data
  }

  // ── Email: Verify OTP ─────────────────────────────────────
  async function verifyOtp(email, otp) {
    const res  = await fetch(`${BACKEND}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Invalid code.')
    _setToken(data.token)
    closeAuthModal()
    return data
  }

  // ── Email: Resend OTP ─────────────────────────────────────
  async function resendOtp(email) {
    const res  = await fetch(`${BACKEND}/api/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Could not resend code.')
    return data
  }

  async function forgotPassword(email) {
    const res  = await fetch(`${BACKEND}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Could not send reset code.')
    return data
  }

  async function resetPassword(email, otp, password) {
    const res  = await fetch(`${BACKEND}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Could not reset password.')
    return data
  }

  // ── Logout ────────────────────────────────────────────────
  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  // ── Guest credit system ───────────────────────────────────
  function useGuestCredit(type) {
    if (user) return true
    const current = loadCredits()
    if (current[type] > 0) {
      const updated = { ...current, [type]: current[type] - 1 }
      saveCredits(updated)
      setGuestCredits(updated)
      return true
    }
    setAuthModalReason(type)
    setAuthModalOpen(true)
    return false
  }

  function openAuthModal(reason = null) {
    setAuthModalReason(reason)
    setAuthModalOpen(true)
  }

  function closeAuthModal() {
    setAuthModalOpen(false)
    setAuthModalReason(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      login: loginWithGoogle,      // kept for backward compat
      loginWithGoogle,
      emailRegister,
      emailLogin,
      verifyOtp,
      resendOtp,
      forgotPassword,
      resetPassword,
      logout,
      getToken,
      authFetch,
      guestCredits,
      useGuestCredit,
      authModalOpen,
      authModalReason,
      openAuthModal,
      closeAuthModal,
      setAuthModalOpen,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}