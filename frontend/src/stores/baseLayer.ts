import { ref } from 'vue'
import { defineStore } from 'pinia'

// Which base tile layer the flat map draws. "mapy" needs a backend MAPY_API_KEY;
// when none is configured the map renders OSM without changing this value, so a
// saved Mapy.com preference survives the key being temporarily unset.
export type BaseLayer = 'osm' | 'mapy'

export function isBaseLayer(value: unknown): value is BaseLayer {
  return value === 'osm' || value === 'mapy'
}

const STORAGE_KEY = 'tripmap.map.baseLayer'
const DEFAULT_BASE_LAYER: BaseLayer = 'osm'

// Null when this device has no explicit choice stored yet, which is what lets
// the account default win on a first visit but not afterwards.
function loadFromStorage(): BaseLayer | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  return isBaseLayer(raw) ? raw : null
}

// The chosen base layer persists across sessions so the map reopens the way the
// user left it. Switching on the map is a session-level choice; the account-level
// default is set on the Settings page and only seeds devices that have no choice
// of their own — see applyDefault().
export const useBaseLayerStore = defineStore('baseLayer', () => {
  const stored = loadFromStorage()
  const baseLayer = ref<BaseLayer>(stored ?? DEFAULT_BASE_LAYER)
  // True once the user has switched on this device (now or in an earlier visit).
  const chosen = ref(stored !== null)

  // An explicit user choice: remembered for next time. Only this writes to
  // storage, so seeding the account default can never masquerade as a choice.
  function set(next: BaseLayer): void {
    baseLayer.value = next
    chosen.value = true
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next)
    }
  }

  // The saved account default, applied on login. Deliberately a no-op once the
  // user has chosen on this device, so a reload doesn't undo their last switch.
  function applyDefault(next: BaseLayer): void {
    if (chosen.value) return
    baseLayer.value = next
  }

  return { baseLayer, chosen, set, applyDefault }
})
