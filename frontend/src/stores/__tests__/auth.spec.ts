// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../auth'
import { getAuthToken, setAuthToken } from '../../api/client'
import { isOidcConfigured } from '../../auth/oidc'

beforeEach(() => {
  setActivePinia(createPinia())
  setAuthToken(null)
})

afterEach(() => {
  vi.restoreAllMocks()
  setAuthToken(null)
})

describe('auth store', () => {
  it('stays unauthenticated when the backend reports no OIDC config', async () => {
    // Backend returns empty issuer/client id → OIDC is considered unconfigured.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ oidc_issuer: '', oidc_client_id: '' }),
      }),
    )
    const auth = useAuthStore()

    await auth.initialize()

    expect(auth.ready).toBe(true)
    expect(auth.isAuthenticated).toBe(false)
    expect(isOidcConfigured()).toBe(false)
  })

  it('auto-authenticates as the dev user when the backend reports dev_auth', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/config')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                oidc_issuer: '',
                oidc_client_id: '',
                dev_auth: true,
              }),
          })
        }
        if (url.includes('/api/me')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: 'dev',
                email: 'dev@localhost',
                display_name: 'Local Dev',
                settings: {
                  theme: 'system',
                  default_projection: 'flat',
                  default_map_filter: 'all',
                },
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z',
              }),
          })
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`))
      }),
    )
    const auth = useAuthStore()

    await auth.initialize()

    expect(auth.ready).toBe(true)
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.devMode).toBe(true)
    expect(auth.user?.email).toBe('dev@localhost')
  })

  it('handleUnauthorized clears the in-memory token from the API client', () => {
    const auth = useAuthStore()
    auth.token = 'stale-token'
    setAuthToken('stale-token')

    auth.handleUnauthorized()

    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
    expect(getAuthToken()).toBeNull()
  })
})
