// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, setAuthToken, setUnauthorizedHandler } from '../client'

beforeEach(() => {
  setAuthToken(null)
  setUnauthorizedHandler(null)
})

afterEach(() => {
  vi.restoreAllMocks()
  setAuthToken(null)
  setUnauthorizedHandler(null)
})

describe('apiFetch', () => {
  it('attaches the bearer token when one is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    setAuthToken('tok-123')

    await apiFetch('/api/me')

    expect(fetchMock).toHaveBeenCalledWith('/api/me', {
      headers: { Authorization: 'Bearer tok-123' },
    })
  })

  it('invokes the unauthorized handler on a 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401 }))
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)

    await apiFetch('/api/locations')

    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('does not invoke the handler on a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 }))
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)

    await apiFetch('/api/locations')

    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})
