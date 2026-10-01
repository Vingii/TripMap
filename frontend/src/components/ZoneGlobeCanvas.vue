<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { GeoJSONSource, StyleSpecification } from 'maplibre-gl'
import type { ZoneCollection } from '../assets/geo'
import { useMapStore } from '../stores/map'
import { useThemeStore } from '../stores/theme'
import {
  zonePalette,
  type ZoneFeatureCollection,
  type ZoneInfo,
} from '../stores/zones'

const props = defineProps<{
  zones: ZoneFeatureCollection
  /** Country polygons, stroked on top so country borders stay prominent. */
  borders: ZoneCollection | null
}>()
const emit = defineEmits<{
  zoneClick: [zone: ZoneInfo]
  zoneHover: [zone: ZoneInfo | null]
}>()

const ZONE_SOURCE = 'zones'
const BORDER_SOURCE = 'borders'
const BACKGROUND_LAYER = 'background'
const FILL_LAYER = 'zones-fill'
const SUBDIVISION_LINE_LAYER = 'zones-subdivision-outline'
const BORDER_LAYER = 'borders-outline'

const EMPTY: ZoneCollection = { type: 'FeatureCollection', features: [] }

// Shares its saved position with the pin map, like the flat zone canvas.
const store = useMapStore()
const theme = useThemeStore()
const containerEl = useTemplateRef<HTMLDivElement>('container')

let map: maplibregl.Map | null = null
let hoveredKey: string | null = null
let resizeObserver: ResizeObserver | null = null

function zoneAt(point: maplibregl.Point): ZoneInfo | null {
  const [hit] =
    map?.queryRenderedFeatures(point, { layers: [FILL_LAYER] }) ?? []
  if (!hit) return null
  // Rebuilt field by field: the tile round-trip drops null-valued properties.
  const p = hit.properties as Partial<ZoneInfo>
  return {
    key: String(p.key),
    name: String(p.name),
    count: Number(p.count ?? 0),
    level: p.level === 'subdivision' ? 'subdivision' : 'country',
    country: p.country ?? null,
    clickable: p.clickable === true,
  }
}

function setHovered(zone: ZoneInfo | null): void {
  const key = zone?.key ?? null
  if (key === hoveredKey) return
  if (hoveredKey !== null) {
    map?.setFeatureState(
      { source: ZONE_SOURCE, id: hoveredKey },
      { hover: false },
    )
  }
  hoveredKey = key
  if (key !== null) {
    map?.setFeatureState({ source: ZONE_SOURCE, id: key }, { hover: true })
  }
  emit('zoneHover', zone)
}

function setZones(): void {
  setHovered(null)
  const source = map?.getSource(ZONE_SOURCE) as GeoJSONSource | undefined
  source?.setData(props.zones)
}

function setBorders(): void {
  const source = map?.getSource(BORDER_SOURCE) as GeoJSONSource | undefined
  source?.setData(props.borders ?? EMPTY)
}

function applyTheme(): void {
  if (!map) return
  const palette = zonePalette(theme.isDark)
  map.getContainer().style.background = palette.space
  if (!map.getLayer(FILL_LAYER)) return
  map.setPaintProperty(BACKGROUND_LAYER, 'background-color', palette.water)
  map.setPaintProperty(FILL_LAYER, 'fill-color', [
    'case',
    ['boolean', ['feature-state', 'hover'], false],
    palette.hover,
    ['>', ['get', 'count'], 0],
    palette.filled,
    palette.empty,
  ])
  map.setPaintProperty(
    SUBDIVISION_LINE_LAYER,
    'line-color',
    palette.subdivisionLine,
  )
  map.setPaintProperty(BORDER_LAYER, 'line-color', palette.countryLine)
}

onMounted(() => {
  if (!containerEl.value) return

  // No base tiles: the background layer paints the sphere itself, so the
  // globe still reads as a globe, and there is no third-party data to credit.
  const style: StyleSpecification = {
    version: 8,
    // Must be part of the initial style — a later setProjection() is lost.
    projection: { type: 'globe' },
    sources: {},
    layers: [
      {
        id: BACKGROUND_LAYER,
        type: 'background',
        paint: { 'background-color': zonePalette(theme.isDark).water },
      },
    ],
  }

  map = new maplibregl.Map({
    container: containerEl.value,
    style,
    // The shared map store keeps coordinates in Leaflet's [lat, lng] order;
    // maplibre wants [lng, lat].
    center: [store.center[1], store.center[0]],
    zoom: store.zoom,
    attributionControl: false,
  })
  map.addControl(new maplibregl.NavigationControl(), 'top-right')
  applyTheme()

  map.on('load', () => {
    if (!map) return
    // `promoteId` lets the hover highlight address a zone by its key.
    map.addSource(ZONE_SOURCE, {
      type: 'geojson',
      data: props.zones,
      promoteId: 'key',
    })
    map.addSource(BORDER_SOURCE, {
      type: 'geojson',
      data: props.borders ?? EMPTY,
    })
    map.addLayer({ id: FILL_LAYER, type: 'fill', source: ZONE_SOURCE })
    map.addLayer({
      id: SUBDIVISION_LINE_LAYER,
      type: 'line',
      source: ZONE_SOURCE,
      filter: ['==', ['get', 'level'], 'subdivision'],
      paint: { 'line-width': 0.5 },
    })
    map.addLayer({
      id: BORDER_LAYER,
      type: 'line',
      source: BORDER_SOURCE,
      paint: { 'line-width': 0.8 },
    })
    applyTheme()
  })

  map.on('click', (event) => {
    const zone = zoneAt(event.point)
    if (zone?.clickable) emit('zoneClick', zone)
  })

  map.on('mousemove', (event) => {
    if (!map) return
    const zone = zoneAt(event.point)
    map.getCanvas().style.cursor = zone?.clickable ? 'pointer' : ''
    setHovered(zone)
  })
  map.on('mouseout', () => setHovered(null))

  const persist = (): void => {
    if (!map) return
    const c = map.getCenter()
    store.setView({ center: [c.lat, c.lng], zoom: map.getZoom() })
  }
  map.on('moveend', persist)

  resizeObserver = new ResizeObserver(() => map?.resize())
  resizeObserver.observe(containerEl.value)
})

watch(() => props.zones, setZones)
watch(() => props.borders, setBorders)
watch(() => theme.isDark, applyTheme)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  map?.remove()
  map = null
  hoveredKey = null
})
</script>

<template>
  <div ref="container" class="h-full w-full" />
</template>
