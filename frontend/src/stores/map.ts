import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

export interface MapViewState {
  center: [number, number]
  zoom: number
}

const STORAGE_KEY = 'tripmap.map.view'
const DEFAULT_VIEW: MapViewState = { center: [20, 0], zoom: 2 }

function loadFromStorage(): MapViewState {
  if (typeof window === 'undefined') return DEFAULT_VIEW
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_VIEW
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'center' in parsed &&
      'zoom' in parsed &&
      Array.isArray((parsed as MapViewState).center) &&
      (parsed as MapViewState).center.length === 2 &&
      typeof (parsed as MapViewState).center[0] === 'number' &&
      typeof (parsed as MapViewState).center[1] === 'number' &&
      typeof (parsed as MapViewState).zoom === 'number'
    ) {
      return parsed as MapViewState
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_VIEW
}

export const useMapStore = defineStore('map', () => {
  const initial = loadFromStorage()
  const center = ref<[number, number]>(initial.center)
  const zoom = ref<number>(initial.zoom)

  function setView(next: MapViewState): void {
    center.value = next.center
    zoom.value = next.zoom
  }

  if (typeof window !== 'undefined') {
    watch(
      [center, zoom],
      ([c, z]) => {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ center: c, zoom: z }),
        )
      },
      { deep: true },
    )
  }

  return { center, zoom, setView }
})
