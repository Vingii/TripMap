<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Location } from '../api/locations'
import { pinIcon } from '../utils/mapPin'

// A small, self-contained map of one album's pins. Unlike MapCanvas it never
// touches the shared map position: it simply frames whatever it is given.
const props = defineProps<{ locations: Location[] }>()

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
// Keeps a single pin (or a tight cluster) from zooming in to street level.
const MAX_FIT_ZOOM = 12

const containerEl = useTemplateRef<HTMLDivElement>('container')

let map: L.Map | null = null
let markerLayer: L.LayerGroup | null = null

function render(): void {
  if (!map) return
  markerLayer?.remove()
  markerLayer = L.layerGroup(
    props.locations.map((location) =>
      L.marker([location.lat, location.lng], {
        icon: pinIcon(location.visited),
      }).bindTooltip(location.name),
    ),
  ).addTo(map)

  if (props.locations.length === 0) {
    map.setView([20, 0], 1)
    return
  }
  const bounds = L.latLngBounds(
    props.locations.map((l) => [l.lat, l.lng] as L.LatLngTuple),
  )
  map.fitBounds(bounds, { padding: [32, 32], maxZoom: MAX_FIT_ZOOM })
}

onMounted(() => {
  if (!containerEl.value) return
  map = L.map(containerEl.value, { worldCopyJump: true })
  L.tileLayer(OSM_TILE_URL, {
    maxZoom: 19,
    attribution: OSM_ATTRIBUTION,
  }).addTo(map)
  render()
})

watch(() => props.locations, render)

onBeforeUnmount(() => {
  map?.remove()
  map = null
  markerLayer = null
})
</script>

<template>
  <div
    ref="container"
    class="h-72 w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
  />
</template>
