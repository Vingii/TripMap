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
import { useBaseLayerStore } from './baseLayer'

// Owns the current user's persisted settings and keeps the live preference
// stores (theme / projection / map filter / base layer) in sync with them.
//
// The map's own toggles are session-level choices remembered per device, so
// loading the profile must not clobber them — it only seeds stores that have no
// local choice yet (`override: false`). Saving on the Settings page is itself an
// explicit choice, so it does take effect immediately (`override: true`).
export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<UserSettings | null>(null)

  function applyToStores(
    s: UserSettings,
    { override }: { override: boolean },
  ): void {
    // Theme and map filter have no competing session state: the nav theme
    // toggle writes straight back through save(), and the filter is per-visit.
    useThemeStore().set(s.theme)
    useMapFilterStore().set(s.default_map_filter)

    const projection = useProjectionStore()
    const baseLayer = useBaseLayerStore()
    if (override) {
      projection.set(s.default_projection)
      baseLayer.set(s.default_base_layer)
    } else {
      projection.applyDefault(s.default_projection)
      baseLayer.applyDefault(s.default_base_layer)
    }
  }

  // Seed from the profile loaded at login. Saved defaults apply only where the
  // user has not already chosen on this device.
  function hydrate(s: UserSettings): void {
    settings.value = s
    applyToStores(s, { override: false })
  }

  async function refresh(): Promise<void> {
    hydrate(await getMySettings())
  }

  async function save(patch: UserSettingsUpdate): Promise<UserSettings> {
    const updated = await updateMySettings(patch)
    settings.value = updated
    // Picking a default in Settings is an explicit act, so it wins over
    // whatever this device had chosen before.
    applyToStores(updated, { override: true })
    return updated
  }

  return { settings, hydrate, refresh, save }
})
