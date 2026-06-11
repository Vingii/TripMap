import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

// Must match the key the pre-hydration script in index.html reads/writes.
const STORAGE_KEY = 'tripmap.theme'

// The pre-hydration script applies the `dark` class before Vue mounts, so the
// class on <html> is the source of truth for the initial state.
function initialIsDark(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('dark')
}

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(initialIsDark())

  function toggle(): void {
    isDark.value = !isDark.value
  }

  if (typeof window !== 'undefined') {
    watch(isDark, (dark) => {
      document.documentElement.classList.toggle('dark', dark)
      window.localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
    })
  }

  return { isDark, toggle }
})
