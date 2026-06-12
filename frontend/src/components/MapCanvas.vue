<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMapStore } from '../stores/map'
import type { Location } from '../api/locations'

const props = defineProps<{ locations: Location[] }>()
const emit = defineEmits<{
  mapClick: [coords: { lat: number; lng: number }]
  markerClick: [location: Location]
}>()

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'

const store = useMapStore()
const containerEl = useTemplateRef<HTMLDivElement>('container')

let map: L.Map | null = null
let markerLayer: L.LayerGroup | null = null
let resizeObserver: ResizeObserver | null = null

function renderMarkers(): void {
  if (!map || !markerLayer) return
  markerLayer.clearLayers()
  for (const location of props.locations) {
    L.circleMarker([location.lat, location.lng], {
      radius: 7,
      weight: 2,
      color: '#1e293b',
      fillColor: '#6366f1',
      fillOpacity: 0.9,
    })
      .bindTooltip(location.name)
      .on('click', (event: L.LeafletMouseEvent) => {
        // Stop the click bubbling to the map, which would open the "new
        // location" form on top of the marker we actually clicked.
        L.DomEvent.stopPropagation(event)
        emit('markerClick', location)
      })
      .addTo(markerLayer)
  }
}

onMounted(() => {
  if (!containerEl.value) return

  map = L.map(containerEl.value, {
    center: store.center,
    zoom: store.zoom,
    zoomControl: true,
  })
  // Keep the zoom buttons clear of the top-left search overlay.
  map.zoomControl.setPosition('topright')
  map.attributionControl.setPrefix(false)

  L.tileLayer(OSM_TILE_URL, {
    maxZoom: 19,
    attribution: OSM_ATTRIBUTION,
  }).addTo(map)

  markerLayer = L.layerGroup().addTo(map)
  renderMarkers()

  map.on('click', (event: L.LeafletMouseEvent) => {
    emit('mapClick', { lat: event.latlng.lat, lng: event.latlng.lng })
  })

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

watch(() => props.locations, renderMarkers)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  map?.remove()
  map = null
  markerLayer = null
})

// Fallback zoom for the rare result that carries no bounding box.
const FALLBACK_ZOOM = 11

interface Bounds {
  south: number
  west: number
  north: number
  east: number
}

function flyToPlace(lat: number, lng: number, bounds: Bounds | null): void {
  if (!map) return
  if (bounds) {
    map.flyToBounds([
      [bounds.south, bounds.west],
      [bounds.north, bounds.east],
    ])
  } else {
    map.flyTo([lat, lng], FALLBACK_ZOOM)
  }
}

defineExpose({ flyToPlace })
</script>

<template>
  <div ref="container" class="h-full w-full" />
</template>
