import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

// The three theme choices the backend persists. "system" follows the OS's
// prefers-color-scheme; "light"/"dark" force the mode.
export type Theme = 'light' | 'dark' | 'system'

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

// Must match the key the pre-hydration script in index.html reads/writes.
const STORAGE_KEY = 'tripmap.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function loadInitial(): Theme {
  if (typeof window === 'undefined') return 'system'
  const raw = window.localStorage.getItem(STORAGE_KEY)
  return isTheme(raw) ? raw : 'system'
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DARK_QUERY).matches
  )
}

// The chosen theme is cached in localStorage so the pre-hydration script can
// apply the `dark` class before first paint; the authoritative value comes from
// the user's saved settings once they load (see the settings store).
export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>(loadInitial())
  const systemDark = ref(systemPrefersDark())

  // Whether dark mode is effectively active right now.
  const isDark = computed(
    () =>
      theme.value === 'dark' || (theme.value === 'system' && systemDark.value),
  )

  function set(next: Theme): void {
    theme.value = next
  }

  // Quick toggle for the nav: collapse to an explicit light/dark choice.
  function toggle(): void {
    theme.value = isDark.value ? 'light' : 'dark'
  }

  if (typeof window !== 'undefined') {
    const applyClass = (dark: boolean): void => {
      document.documentElement.classList.toggle('dark', dark)
    }
    applyClass(isDark.value)
    watch(isDark, applyClass)

    watch(theme, (value) => {
      window.localStorage.setItem(STORAGE_KEY, value)
    })

    if (typeof window.matchMedia === 'function') {
      window.matchMedia(DARK_QUERY).addEventListener('change', (event) => {
        systemDark.value = event.matches
      })
    }
  }

  return { theme, isDark, set, toggle }
})
