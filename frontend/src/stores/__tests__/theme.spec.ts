// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { isTheme, useThemeStore } from '../theme'

// Force a deterministic OS preference so "system" resolves predictably.
function stubPrefersDark(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  stubPrefersDark(false)
})

describe('theme store', () => {
  it('defaults to "system" when nothing is persisted', () => {
    const store = useThemeStore()
    expect(store.theme).toBe('system')
  })

  it('initialises from the persisted theme', () => {
    localStorage.setItem('tripmap.theme', 'dark')
    const store = useThemeStore()
    expect(store.theme).toBe('dark')
    expect(store.isDark).toBe(true)
  })

  it('resolves "system" against the OS preference', () => {
    stubPrefersDark(true)
    localStorage.setItem('tripmap.theme', 'system')
    const store = useThemeStore()
    expect(store.isDark).toBe(true)
  })

  it('set() persists the choice and applies the class', async () => {
    const store = useThemeStore()

    store.set('dark')
    await nextTick()
    expect(store.isDark).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('tripmap.theme')).toBe('dark')

    store.set('light')
    await nextTick()
    expect(store.isDark).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('tripmap.theme')).toBe('light')
  })

  it('toggle() collapses to an explicit light/dark choice', async () => {
    const store = useThemeStore()

    store.toggle()
    await nextTick()
    expect(store.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    store.toggle()
    await nextTick()
    expect(store.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

describe('isTheme', () => {
  it('accepts the known theme values', () => {
    expect(isTheme('light')).toBe(true)
    expect(isTheme('dark')).toBe(true)
    expect(isTheme('system')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isTheme('neon')).toBe(false)
    expect(isTheme(null)).toBe(false)
  })
})
