import { ref } from 'vue'
import { defineStore } from 'pinia'

// Which map projection the user is viewing: the flat 2D OSM map or the 3D globe.
export type Projection = 'flat' | 'globe'

export function isProjection(value: unknown): value is Projection {
  return value === 'flat' || value === 'globe'
}

const STORAGE_KEY = 'tripmap.map.projection'
const DEFAULT_PROJECTION: Projection = 'flat'

// Null when this device has no explicit choice stored yet, which is what lets
// the account default win on a first visit but not afterwards.
function loadFromStorage(): Projection | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  return isProjection(raw) ? raw : null
}

// The chosen projection persists across sessions so the map reopens the way the
// user left it. Toggling on the map is a session-level choice; the account-level
// default is set on the Settings page and only seeds devices that have no choice
// of their own — see applyDefault().
export const useProjectionStore = defineStore('projection', () => {
  const stored = loadFromStorage()
  const projection = ref<Projection>(stored ?? DEFAULT_PROJECTION)
  // True once the user has toggled on this device (now or in an earlier visit).
  const chosen = ref(stored !== null)

  // An explicit user choice: remembered for next time. Only this writes to
  // storage, so seeding the account default can never masquerade as a choice.
  function set(next: Projection): void {
    projection.value = next
    chosen.value = true
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next)
    }
  }

  // The saved account default, applied on login. Deliberately a no-op once the
  // user has chosen on this device, so a reload doesn't undo their last toggle.
  function applyDefault(next: Projection): void {
    if (chosen.value) return
    projection.value = next
  }

  return { projection, chosen, set, applyDefault }
})
