import { ref, watch } from 'vue'
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

function loadFromStorage(): BaseLayer {
  if (typeof window === 'undefined') return DEFAULT_BASE_LAYER
  const raw = window.localStorage.getItem(STORAGE_KEY)
  return isBaseLayer(raw) ? raw : DEFAULT_BASE_LAYER
}

// The chosen base layer persists across sessions so the map reopens the way the
// user left it. Switching layers on the map is a session-level override; the
// saved account default is set on the Settings page.
export const useBaseLayerStore = defineStore('baseLayer', () => {
  const baseLayer = ref<BaseLayer>(loadFromStorage())

  function set(next: BaseLayer): void {
    baseLayer.value = next
  }

  if (typeof window !== 'undefined') {
    watch(baseLayer, (value) => {
      window.localStorage.setItem(STORAGE_KEY, value)
    })
  }

  return { baseLayer, set }
})
