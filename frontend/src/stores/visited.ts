import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

// Visited state is client-side only until auth (TM-20) introduces a current
// user; at that point it moves to the per-user `user_location_states` table.
// Until then we persist the set of visited location ids in localStorage.
const STORAGE_KEY = 'tripmap.visited'

function loadFromStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return new Set(
        parsed.filter((id): id is string => typeof id === 'string'),
      )
    }
  } catch {
    // fall through to an empty set
  }
  return new Set()
}

export const useVisitedStore = defineStore('visited', () => {
  const ids = ref<Set<string>>(loadFromStorage())

  function isVisited(id: string): boolean {
    return ids.value.has(id)
  }

  function toggle(id: string): void {
    // Replace the Set so reactivity tracking fires for `ids`.
    const next = new Set(ids.value)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    ids.value = next
  }

  if (typeof window !== 'undefined') {
    watch(ids, (value) => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...value]))
    })
  }

  return { ids, isVisited, toggle }
})
