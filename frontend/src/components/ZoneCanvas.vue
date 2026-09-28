<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Feature } from 'geojson'
import {
  zoneTooltip,
  type ZoneFeature,
  type ZoneFeatureCollection,
  type ZoneInfo,
} from '../stores/zones'

const props = defineProps<{
  zones: ZoneFeatureCollection
  /** Non-null while drilled into one country; frames that country's extent. */
  focusKey: string | null
}>()
const emit = defineEmits<{
  zoneClick: [zone: ZoneInfo]
  background: []
}>()

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'

// The zone view opens on the whole world rather than restoring the pin map's
// saved position, and deliberately does not write back to the map store —
// drilling into a country should not move the pin map next time it opens.
const WORLD_CENTER: L.LatLngTuple = [20, 0]
const WORLD_ZOOM = 2

// Same indigo accent as the pins for zones holding locations; empty zones stay
// a muted grey that reads as "nothing here" on both light and dark tiles.
const FILLED = '#6366f1'
const EMPTY = '#64748b'

const containerEl = useTemplateRef<HTMLDivElement>('container')

let map: L.Map | null = null
let zoneLayer: L.GeoJSON | null = null
let resizeObserver: ResizeObserver | null = null

function styleFor(feature?: Feature): L.PathOptions {
  const count = (feature as ZoneFeature | undefined)?.properties.count ?? 0
  return {
    fillColor: count > 0 ? FILLED : EMPTY,
    fillOpacity: count > 0 ? 0.6 : 0.15,
    color: '#ffffff',
    weight: 1,
  }
}

function renderZones(): void {
  if (!map) return
  if (zoneLayer) {
    map.removeLayer(zoneLayer)
    zoneLayer = null
  }

  zoneLayer = L.geoJSON(props.zones, {
    style: styleFor,
    onEachFeature: (feature, layer) => {
      const zone = (feature as ZoneFeature).properties
      // `sticky` keeps the tooltip under the cursor rather than pinning it to
      // the polygon's centroid, which for a large country is far off screen.
      layer.bindTooltip(zoneTooltip(zone), { sticky: true })
      layer.on('click', (event: L.LeafletMouseEvent) => {
        // Otherwise the map's own click handler also fires and immediately
        // navigates back out of the country just selected.
        L.DomEvent.stopPropagation(event)
        emit('zoneClick', zone)
      })
    },
  }).addTo(map)

  applyFocus()
}

/** Frames the drilled-into country, or returns to the world view. */
function applyFocus(): void {
  if (!map) return
  if (props.focusKey && zoneLayer) {
    const bounds = zoneLayer.getBounds()
    if (bounds.isValid()) map.flyToBounds(bounds)
  } else {
    map.flyTo(WORLD_CENTER, WORLD_ZOOM)
  }
}

onMounted(() => {
  if (!containerEl.value) return

  map = L.map(containerEl.value, {
    center: WORLD_CENTER,
    zoom: WORLD_ZOOM,
    zoomControl: true,
  })
  map.zoomControl.setPosition('topright')
  map.attributionControl.setPrefix(false)
  L.tileLayer(OSM_TILE_URL, {
    maxZoom: 19,
    attribution: OSM_ATTRIBUTION,
  }).addTo(map)

  renderZones()

  // Anything that is not a polygon — ocean, or the gaps between zones.
  map.on('click', () => emit('background'))

  resizeObserver = new ResizeObserver(() => map?.invalidateSize())
  resizeObserver.observe(containerEl.value)
})

watch(() => props.zones, renderZones)
watch(() => props.focusKey, applyFocus)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  map?.remove()
  map = null
  zoneLayer = null
})
</script>

<template>
  <div ref="container" class="h-full w-full" />
</template>
