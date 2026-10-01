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
// local choice yet. Saving is itself an explicit choice, so the fields being
// saved do take effect immediately — but only those: the nav theme toggle saves
// just `theme`, and must not reset the map's projection or filter on the way.
export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<UserSettings | null>(null)

  // Seed from the profile loaded at login. Saved defaults apply only where the
  // user has not already chosen on this device.
  function hydrate(s: UserSettings): void {
    settings.value = s
    // Theme and map filter have no competing session state: the nav theme
    // toggle writes straight back through save(), and the filter is per-visit.
    useThemeStore().set(s.theme)
    useMapFilterStore().set(s.default_map_filter)
    useProjectionStore().applyDefault(s.default_projection)
    useBaseLayerStore().applyDefault(s.default_base_layer)
  }

  async function refresh(): Promise<void> {
    hydrate(await getMySettings())
  }

  async function save(patch: UserSettingsUpdate): Promise<UserSettings> {
    const updated = await updateMySettings(patch)
    settings.value = updated
    // Picking a default is an explicit act, so it wins over whatever this
    // device had chosen before — for the fields in this patch only.
    if (patch.theme !== undefined) useThemeStore().set(updated.theme)
    if (patch.default_map_filter !== undefined) {
      useMapFilterStore().set(updated.default_map_filter)
    }
    if (patch.default_projection !== undefined) {
      useProjectionStore().set(updated.default_projection)
    }
    if (patch.default_base_layer !== undefined) {
      useBaseLayerStore().set(updated.default_base_layer)
    }
    return updated
  }

  return { settings, hydrate, refresh, save }
})
