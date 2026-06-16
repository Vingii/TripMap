import { ref } from 'vue'
import { defineStore } from 'pinia'

// Which subset of locations the map shows. "visited" is "My visited" today —
// every location flagged visited — and re-scopes to the current user in TM-20.
export type MapFilter = 'all' | 'visited'

export function isMapFilter(value: unknown): value is MapFilter {
  return value === 'all' || value === 'visited'
}

export const useMapFilterStore = defineStore('mapFilter', () => {
  const filter = ref<MapFilter>('all')

  function set(next: MapFilter): void {
    filter.value = next
  }

  return { filter, set }
})
