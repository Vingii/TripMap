import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

// Which map projection the user is viewing: the flat 2D OSM map or the 3D globe.
export type Projection = 'flat' | 'globe'

export function isProjection(value: unknown): value is Projection {
  return value === 'flat' || value === 'globe'
}

const STORAGE_KEY = 'tripmap.map.projection'
const DEFAULT_PROJECTION: Projection = 'flat'

function loadFromStorage(): Projection {
  if (typeof window === 'undefined') return DEFAULT_PROJECTION
  const raw = window.localStorage.getItem(STORAGE_KEY)
  return isProjection(raw) ? raw : DEFAULT_PROJECTION
}

// The chosen projection persists across sessions so the map reopens the way the
// user left it.
export const useProjectionStore = defineStore('projection', () => {
  const projection = ref<Projection>(loadFromStorage())

  function set(next: Projection): void {
    projection.value = next
  }

  if (typeof window !== 'undefined') {
    watch(projection, (value) => {
      window.localStorage.setItem(STORAGE_KEY, value)
    })
  }

  return { projection, set }
})
