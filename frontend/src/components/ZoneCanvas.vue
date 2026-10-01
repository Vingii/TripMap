<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Feature } from 'geojson'
import type { ZoneCollection } from '../assets/geo'
import { useThemeStore } from '../stores/theme'
import {
  zonePalette,
  type ZoneFeature,
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

// The zone view opens on the whole world rather than restoring the pin map's
// saved position, and deliberately does not write back to the map store.
const WORLD_CENTER: L.LatLngTuple = [20, 0]
const WORLD_ZOOM = 2

const theme = useThemeStore()
const containerEl = useTemplateRef<HTMLDivElement>('container')

let map: L.Map | null = null
let zoneLayer: L.GeoJSON | null = null
let borderLayer: L.GeoJSON | null = null
let hovered: L.Path | null = null
let resizeObserver: ResizeObserver | null = null

function styleFor(feature?: Feature): L.PathOptions {
  const zone = (feature as ZoneFeature | undefined)?.properties
  const palette = zonePalette(theme.isDark)
  const filled = (zone?.count ?? 0) > 0
  return {
    fillColor: filled ? palette.filled : palette.empty,
    fillOpacity: 1,
    color: palette.subdivisionLine,
    weight: zone?.level === 'subdivision' ? 0.5 : 0,
    // Leaflet gives every interactive path a pointer cursor; inherit the map's
    // grab cursor instead where a click would do nothing.
    className: zone?.clickable ? '' : 'cursor-[inherit]!',
  }
}

function borderStyle(): L.PathOptions {
  return {
    color: zonePalette(theme.isDark).countryLine,
    weight: 0.8,
    fill: false,
    interactive: false,
  }
}

function setHovered(layer: L.Path | null, zone: ZoneInfo | null): void {
  if (hovered && hovered !== layer) zoneLayer?.resetStyle(hovered)
  hovered = layer
  layer?.setStyle({ fillColor: zonePalette(theme.isDark).hover })
  emit('zoneHover', zone)
}

function renderZones(): void {
  if (!map) return
  zoneLayer?.remove()
  // The layer under the pointer is about to be replaced; clear the panel
  // rather than leave it describing a polygon that no longer exists.
  if (hovered) setHovered(null, null)

  zoneLayer = L.geoJSON(props.zones, {
    style: styleFor,
    onEachFeature: (feature, layer) => {
      const zone = (feature as ZoneFeature).properties
      const path = layer as L.Path
      path.on('mouseover', () => setHovered(path, zone))
      path.on('mouseout', () => {
        if (hovered === path) setHovered(null, null)
      })
      path.on('click', () => {
        if (zone.clickable) emit('zoneClick', zone)
      })
    },
  }).addTo(map)

  // Re-adding keeps the borders above the freshly drawn fills.
  borderLayer?.bringToFront()
}

function renderBorders(): void {
  if (!map) return
  borderLayer?.remove()
  borderLayer = props.borders
    ? L.geoJSON(props.borders, { style: borderStyle }).addTo(map)
    : null
}

function applyTheme(): void {
  if (!map) return
  map.getContainer().style.background = zonePalette(theme.isDark).water
  zoneLayer?.setStyle(styleFor)
  borderLayer?.setStyle(borderStyle)
  hovered?.setStyle({ fillColor: zonePalette(theme.isDark).hover })
}

onMounted(() => {
  if (!containerEl.value) return

  // No base tiles: the polygons are the whole picture, so there is no
  // third-party data to attribute either.
  map = L.map(containerEl.value, {
    center: WORLD_CENTER,
    zoom: WORLD_ZOOM,
    zoomControl: true,
    attributionControl: false,
  })
  map.zoomControl.setPosition('topright')

  renderBorders()
  renderZones()
  applyTheme()

  resizeObserver = new ResizeObserver(() => map?.invalidateSize())
  resizeObserver.observe(containerEl.value)
})

watch(() => props.zones, renderZones)
watch(
  () => props.borders,
  () => {
    renderBorders()
    applyTheme()
  },
)
watch(() => theme.isDark, applyTheme)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  map?.remove()
  map = null
  zoneLayer = null
  borderLayer = null
  hovered = null
})
</script>

<template>
  <div ref="container" class="h-full w-full" />
</template>
