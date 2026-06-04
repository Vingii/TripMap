<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMapStore } from '../stores/map'

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'

const store = useMapStore()
const containerEl = useTemplateRef<HTMLDivElement>('container')

let map: L.Map | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!containerEl.value) return

  map = L.map(containerEl.value, {
    center: store.center,
    zoom: store.zoom,
    zoomControl: true,
  })

  L.tileLayer(OSM_TILE_URL, {
    maxZoom: 19,
    attribution: OSM_ATTRIBUTION,
  }).addTo(map)

  const persist = (): void => {
    if (!map) return
    const c = map.getCenter()
    store.setView({ center: [c.lat, c.lng], zoom: map.getZoom() })
  }
  map.on('moveend', persist)
  map.on('zoomend', persist)

  resizeObserver = new ResizeObserver(() => map?.invalidateSize())
  resizeObserver.observe(containerEl.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="container" class="h-full w-full" />
</template>
