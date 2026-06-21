import { ref } from 'vue'
import { defineStore } from 'pinia'
import { setAuthToken } from '../api/client'
import { getMe, type User } from '../api/me'

// The bearer token is persisted here so a page reload keeps the session. The
// SPA login flow that populates it (Authentik Authorization Code + PKCE) lands
// in a later task; until then a token can be injected into localStorage for
// development. The store mirrors the token into the API client on every change.
const TOKEN_KEY = 'tripmap.token'

function loadToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(loadToken())
  const user = ref<User | null>(null)
  const loading = ref(false)

  // Seed the API client with whatever token we restored from storage.
  setAuthToken(token.value)

  function setToken(next: string | null): void {
    token.value = next
    setAuthToken(next)
    if (typeof window !== 'undefined') {
      if (next) window.localStorage.setItem(TOKEN_KEY, next)
      else window.localStorage.removeItem(TOKEN_KEY)
    }
  }

  /**
   * Load the current user's profile. No-ops without a token, and clears the
   * session on a 401 so a stale token doesn't leave the UI in a wedged state.
   */
  async function loadUser(): Promise<void> {
    if (!token.value) {
      user.value = null
      return
    }
    loading.value = true
    try {
      user.value = await getMe()
    } catch {
      user.value = null
      setToken(null)
    } finally {
      loading.value = false
    }
  }

  function logout(): void {
    user.value = null
    setToken(null)
  }

  return { token, user, loading, setToken, loadUser, logout }
})
