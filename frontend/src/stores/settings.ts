import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  getMySettings,
  updateMySettings,
  type UserSettings,
  type UserSettingsUpdate,
} from '../api/me'
import { useThemeStore } from './theme'
import { useProjectionStore } from './projection'
import { useMapFilterStore } from './mapFilter'

// Owns the current user's persisted settings and keeps the live preference
// stores (theme / projection / map filter) in sync with them. The Settings page
// writes through save(); the map's own toggles are session-level overrides that
// do not change the saved defaults.
export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<UserSettings | null>(null)

  function applyToStores(s: UserSettings): void {
    useThemeStore().set(s.theme)
    useProjectionStore().set(s.default_projection)
    useMapFilterStore().set(s.default_map_filter)
  }

  // Seed from the profile loaded at login, applying the saved defaults.
  function hydrate(s: UserSettings): void {
    settings.value = s
    applyToStores(s)
  }

  async function refresh(): Promise<void> {
    hydrate(await getMySettings())
  }

  async function save(patch: UserSettingsUpdate): Promise<UserSettings> {
    const updated = await updateMySettings(patch)
    hydrate(updated)
    return updated
  }

  return { settings, hydrate, refresh, save }
})
