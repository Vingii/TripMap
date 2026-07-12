// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { RouteLocationNormalized } from 'vue-router'
import { authGuard } from '../index'
import { useAuthStore } from '../../stores/auth'

function route(
  meta: Record<string, unknown>,
  fullPath = '/map',
): RouteLocationNormalized {
  return { meta, fullPath } as unknown as RouteLocationNormalized
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('authGuard', () => {
  it('allows public routes without a session', () => {
    expect(authGuard(route({ public: true }, '/login'))).toBe(true)
  })

  it('redirects an unauthenticated user to /login, preserving the target', () => {
    expect(authGuard(route({}, '/map'))).toEqual({
      name: 'login',
      query: { redirect: '/map' },
    })
  })

  it('allows a protected route once authenticated', () => {
    const auth = useAuthStore()
    auth.token = 'a-token'
    expect(authGuard(route({}, '/map'))).toBe(true)
  })
})
