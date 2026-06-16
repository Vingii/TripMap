<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
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

const MARKER_COLOR = '#6366f1'

// Teardrop map pin: rounded head, pointed tip at the bottom-centre (24×36, tip
// at 12,36). Visited pins are filled solid; unvisited ones are a hollow outline.
function pinIcon(visited: boolean): L.DivIcon {
  const fill = visited ? MARKER_COLOR : '#ffffff'
  const stroke = visited ? '#1e293b' : MARKER_COLOR
  const dot = visited ? '#ffffff' : MARKER_COLOR
  const svg = `
    <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0Z"
            fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="${dot}"/>
    </svg>`
  return L.divIcon({
    html: svg,
    className: '', // drop the default white box so only the SVG shows
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    tooltipAnchor: [0, -30],
  })
}

function markerFor(location: Location): L.Marker {
  return L.marker([location.lat, location.lng], {
    icon: pinIcon(location.visited),
  })
    .bindTooltip(location.name)
    .on('click', (event: L.LeafletMouseEvent) => {
      // Stop the click bubbling to the map, which would open the "new
      // location" form on top of the marker we actually clicked.
      L.DomEvent.stopPropagation(event)
      emit('markerClick', location)
    })
}

function renderMarkers(): void {
  if (!map) return
  if (markerLayer) {
    map.removeLayer(markerLayer)
    markerLayer = null
  }
  // markercluster groups pins by proximity per zoom level and breaks them out
  // into individual markers once they're far enough apart, so it's always on.
  markerLayer = L.markerClusterGroup()
  for (const location of props.locations) {
    markerLayer.addLayer(markerFor(location))
  }
  markerLayer.addTo(map)
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
