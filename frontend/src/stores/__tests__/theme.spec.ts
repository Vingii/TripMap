// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useThemeStore } from '../theme'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('theme store', () => {
  it('initialises from the `dark` class on <html> set before hydration', () => {
    document.documentElement.classList.add('dark')
    const store = useThemeStore()
    expect(store.isDark).toBe(true)
  })

  it('defaults to light when no `dark` class is present', () => {
    const store = useThemeStore()
    expect(store.isDark).toBe(false)
  })

  it('toggle() flips the class on <html> and persists to localStorage', async () => {
    const store = useThemeStore()

    store.toggle()
    await nextTick()
    expect(store.isDark).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('tripmap.theme')).toBe('dark')

    store.toggle()
    await nextTick()
    expect(store.isDark).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('tripmap.theme')).toBe('light')
  })
})
