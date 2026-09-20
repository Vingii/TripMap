// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useConfigStore } from '../config'

function mockConfigResponse(body: unknown, ok = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(body),
    }),
  )
}

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('config store', () => {
  it('reports no Mapy.com key before the config is loaded', () => {
    const store = useConfigStore()
    expect(store.mapyApiKey).toBe('')
  })

  it('exposes the Mapy.com key from the backend config', async () => {
    mockConfigResponse({
      oidc_issuer: '',
      oidc_client_id: '',
      mapy_api_key: 'test-key',
    })
    const store = useConfigStore()

    await store.load()

    expect(store.mapyApiKey).toBe('test-key')
  })

  it('reports no key when the backend has none configured', async () => {
    mockConfigResponse({
      oidc_issuer: '',
      oidc_client_id: '',
      mapy_api_key: '',
    })
    const store = useConfigStore()

    await store.load()

    expect(store.mapyApiKey).toBe('')
  })

  it('fetches once for concurrent and repeated loads', async () => {
    mockConfigResponse({
      oidc_issuer: '',
      oidc_client_id: '',
      mapy_api_key: 'test-key',
    })
    const store = useConfigStore()

    await Promise.all([store.load(), store.load()])
    await store.load()

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries after a failed load rather than caching the failure', async () => {
    mockConfigResponse(null, false)
    const store = useConfigStore()

    await expect(store.load()).rejects.toThrow()
    expect(store.mapyApiKey).toBe('')

    mockConfigResponse({
      oidc_issuer: '',
      oidc_client_id: '',
      mapy_api_key: 'test-key',
    })
    await store.load()

    expect(store.mapyApiKey).toBe('test-key')
  })
})
