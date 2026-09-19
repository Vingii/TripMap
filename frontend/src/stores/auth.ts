import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { User as OidcUser } from 'oidc-client-ts'
import { setAuthToken, setUnauthorizedHandler } from '../api/client'
import { getMe, type User } from '../api/me'
import { useSettingsStore } from './settings'
import { router } from '../router'
import {
  CALLBACK_PATH,
  getUserManager,
  initOidc,
  isOidcConfigured,
} from '../auth/oidc'

// The access token lives only in this store (in memory) — never in web storage.
// A hard reload therefore starts tokenless and re-establishes the session via
// silent renew in initialize(). See auth/oidc.ts for the rationale.

// Login state passed through the Authentik redirect so we can return the user
// to the page they originally requested.
interface LoginState {
  returnTo?: string
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<User | null>(null)
  const ready = ref(false)
  const loading = ref(false)

  const isAuthenticated = computed(() => token.value !== null)

  function applyUser(oidcUser: OidcUser): void {
    token.value = oidcUser.access_token
    setAuthToken(oidcUser.access_token)
  }

  function clearSession(): void {
    token.value = null
    user.value = null
    setAuthToken(null)
  }

  /** Load the current user's profile; no-ops without a token. */
  async function loadUser(): Promise<void> {
    if (!token.value) {
      user.value = null
      return
    }
    loading.value = true
    try {
      const profile = await getMe()
      user.value = profile
      // Apply the user's saved preferences to the live stores.
      useSettingsStore().hydrate(profile.settings)
    } catch {
      // A 401 is handled by the unauthorized handler; other errors just leave
      // the profile empty without tearing down an otherwise valid session.
      user.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * Bootstrap auth before the app mounts. Loads runtime OIDC config, wires the
   * token-expiry / unauthorized hooks, and attempts a silent sign-in so a fresh
   * page load transparently restores the session. Always resolves; failure just
   * leaves the app unauthenticated for the router guard to redirect.
   */
  async function initialize(): Promise<void> {
    const configured = await initOidc()
    if (!configured) {
      ready.value = true
      return
    }

    setUnauthorizedHandler(handleUnauthorized)
    const manager = getUserManager()
    // Keep the in-memory token fresh across automatic silent renews.
    manager.events.addUserLoaded((u) => applyUser(u))
    manager.events.addAccessTokenExpired(() => handleUnauthorized())

    // On the callback route the dedicated view completes the exchange; don't
    // race it with a silent sign-in here.
    if (window.location.pathname === CALLBACK_PATH) {
      ready.value = true
      return
    }

    try {
      const u = await manager.signinSilent()
      if (u && !u.expired) {
        applyUser(u)
        await loadUser()
      }
    } catch {
      // Not signed in — the guard will route to /login.
    } finally {
      ready.value = true
    }
  }

  /** Begin the Authorization Code + PKCE redirect to Authentik. */
  async function login(returnTo = '/'): Promise<void> {
    if (!isOidcConfigured()) return
    const state: LoginState = { returnTo }
    await getUserManager().signinRedirect({ state })
  }

  /**
   * Complete the login redirect. Returns the path the user should land on
   * (the page they originally requested, or home).
   */
  async function completeLogin(): Promise<string> {
    const oidcUser = await getUserManager().signinCallback()
    if (!oidcUser) throw new Error('Login callback produced no user')
    applyUser(oidcUser)
    await loadUser()
    const state = oidcUser.state as LoginState | undefined
    return state?.returnTo ?? '/'
  }

  /** User-initiated logout: clear the in-memory session and go to /login. */
  async function logout(): Promise<void> {
    clearSession()
    if (isOidcConfigured()) {
      // Drop the local user so a later visit re-runs silent sign-in cleanly.
      try {
        await getUserManager().removeUser()
      } catch {
        // best effort
      }
    }
    if (router.currentRoute.value.name !== 'login') {
      await router.push({ name: 'login' })
    }
  }

  /** A 401 from any API call: drop the session and bounce to /login. */
  function handleUnauthorized(): void {
    clearSession()
    if (isOidcConfigured()) {
      void getUserManager()
        .removeUser()
        .catch(() => {})
    }
    const current = router.currentRoute.value
    if (current.name !== 'login') {
      void router.replace({
        name: 'login',
        query: { redirect: current.fullPath },
      })
    }
  }

  return {
    token,
    user,
    ready,
    loading,
    isAuthenticated,
    initialize,
    login,
    completeLogin,
    logout,
    loadUser,
    handleUnauthorized,
  }
})
