<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { GeoJSONSource, StyleSpecification } from 'maplibre-gl'
import {
  boundsOf,
  zoneTooltip,
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

// Matches the flat zone canvas: the world, not the pin map's saved position.
const WORLD_CENTER: [number, number] = [0, 20]
const WORLD_ZOOM = 2

const FILLED = '#6366f1'
const EMPTY = '#64748b'

const SOURCE_ID = 'zones'
const FILL_LAYER = 'zones-fill'
const LINE_LAYER = 'zones-outline'

const containerEl = useTemplateRef<HTMLDivElement>('container')

let map: maplibregl.Map | null = null
let popup: maplibregl.Popup | null = null
let resizeObserver: ResizeObserver | null = null

function setData(): void {
  const source = map?.getSource(SOURCE_ID) as GeoJSONSource | undefined
  source?.setData(props.zones)
  applyFocus()
}

/** Frames the drilled-into country, or returns to the world view. */
function applyFocus(): void {
  if (!map) return
  if (!props.focusKey) {
    map.flyTo({ center: WORLD_CENTER, zoom: WORLD_ZOOM })
    return
  }
  const bounds = boundsOf(props.zones)
  if (bounds) {
    const [west, south, east, north] = bounds
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 40 },
    )
  }
}

function zoneAt(point: maplibregl.Point): ZoneInfo | null {
  const [hit] =
    map?.queryRenderedFeatures(point, { layers: [FILL_LAYER] }) ?? []
  // Feature properties survive the tile round-trip as plain JSON values.
  return hit ? (hit.properties as unknown as ZoneInfo) : null
}

onMounted(() => {
  if (!containerEl.value) return

  const style: StyleSpecification = {
    version: 8,
    // Must be part of the initial style — a later setProjection() is lost.
    projection: { type: 'globe' },
    sources: {
      osm: {
        type: 'raster',
        tiles: [OSM_TILE_URL],
        tileSize: 256,
        maxzoom: 19,
        attribution: OSM_ATTRIBUTION,
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  }

  map = new maplibregl.Map({
    container: containerEl.value,
    style,
    center: WORLD_CENTER,
    zoom: WORLD_ZOOM,
    attributionControl: { compact: false },
  })
  map.addControl(new maplibregl.NavigationControl(), 'top-right')

  map.on('load', () => {
    if (!map) return
    map.addSource(SOURCE_ID, { type: 'geojson', data: props.zones })
    map.addLayer({
      id: FILL_LAYER,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': ['case', ['>', ['get', 'count'], 0], FILLED, EMPTY],
        'fill-opacity': ['case', ['>', ['get', 'count'], 0], 0.6, 0.15],
      },
    })
    map.addLayer({
      id: LINE_LAYER,
      type: 'line',
      source: SOURCE_ID,
      paint: { 'line-color': '#ffffff', 'line-width': 1 },
    })
    applyFocus()
  })

  // One handler for both cases: maplibre would otherwise fire a layer-scoped
  // click and the map-wide click for the same press.
  map.on('click', (event) => {
    const zone = zoneAt(event.point)
    if (zone) emit('zoneClick', zone)
    else emit('background')
  })

  map.on('mousemove', (event) => {
    if (!map) return
    const zone = zoneAt(event.point)
    map.getCanvas().style.cursor = zone ? 'pointer' : ''
    if (!zone) {
      popup?.remove()
      popup = null
      return
    }
    popup ??= new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
    })
    popup.setLngLat(event.lngLat).setText(zoneTooltip(zone)).addTo(map)
  })

  resizeObserver = new ResizeObserver(() => map?.resize())
  resizeObserver.observe(containerEl.value)
})

watch(() => props.zones, setData)
watch(() => props.focusKey, applyFocus)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  popup?.remove()
  popup = null
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="container" class="h-full w-full" />
</template>
