<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { useMapStore } from '../stores/map'
import { useConfigStore } from '../stores/config'
import { useBaseLayerStore } from '../stores/baseLayer'
import type { Location } from '../api/locations'

const props = defineProps<{ locations: Location[] }>()
const emit = defineEmits<{
  mapClick: [coords: { lat: number; lng: number }]
  markerClick: [location: Location]
}>()

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'

// Mapy.com (Seznam) REST Tiles API. `basic` is the general-purpose set; the
// 256px variant matches Leaflet's default tile size. The key comes from the
// backend at runtime (see stores/config), so it is never baked into the build.
// OSM stays the default base layer, which also means Mapy.com credits are only
// spent when a user explicitly switches to it.
const MAPY_TILE_URL = 'https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}'
// tiles.json is the authoritative source for the set's zoom range; 19 matches
// the OSM layer so switching base layers never forces a zoom change.
const MAPY_MAX_ZOOM = 19
// Mandatory attribution per developer.mapy.com/rest-api-mapy-cz/atribution:
// the copyright text links to the licence page, and the logo (below) sits over
// the map at >= 30px and links to mapy.com.
const MAPY_ATTRIBUTION =
  '&copy; <a href="https://api.mapy.com/copyright" target="_blank" rel="noopener">Seznam.cz a.s. and others</a>'
const MAPY_LOGO_URL = 'https://api.mapy.com/img/api/logo.svg'
const MAPY_LOGO_HEIGHT_PX = 30

const store = useMapStore()
const config = useConfigStore()
const baseLayer = useBaseLayerStore()
const containerEl = useTemplateRef<HTMLDivElement>('container')

let map: L.Map | null = null
let markerLayer: L.LayerGroup | null = null
let resizeObserver: ResizeObserver | null = null
let osmLayer: L.TileLayer | null = null
let mapyLayer: L.TileLayer | null = null
let mapyLogo: L.Control | null = null

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

// Carries the location's visited flag so a cluster can colour itself by whether
// any of its children are visited.
interface VisitedMarker extends L.Marker {
  visited: boolean
}

function markerFor(location: Location): VisitedMarker {
  const marker = L.marker([location.lat, location.lng], {
    icon: pinIcon(location.visited),
  }) as VisitedMarker
  marker.visited = location.visited
  marker
    .bindTooltip(location.name)
    .on('click', (event: L.LeafletMouseEvent) => {
      // Stop the click bubbling to the map, which would open the "new
      // location" form on top of the marker we actually clicked.
      L.DomEvent.stopPropagation(event)
      emit('markerClick', location)
    })
  return marker
}

// Cluster bubble styled like the pins: filled blue if any child is visited,
// otherwise a hollow white circle with a blue outline.
function clusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const anyVisited = cluster
    .getAllChildMarkers()
    .some((m) => (m as VisitedMarker).visited)
  const bg = anyVisited ? MARKER_COLOR : '#ffffff'
  const fg = anyVisited ? '#ffffff' : MARKER_COLOR
  const border = anyVisited ? '#1e293b' : MARKER_COLOR
  const html = `
    <div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px;background:${bg};color:${fg};border:2px solid ${border};font:600 13px/1 system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,0.3);">${cluster.getChildCount()}</div>`
  return L.divIcon({ html, className: '', iconSize: [36, 36] })
}

function renderMarkers(): void {
  if (!map) return
  if (markerLayer) {
    map.removeLayer(markerLayer)
    markerLayer = null
  }
  // markercluster groups pins by proximity per zoom level and breaks them out
  // into individual markers once they're far enough apart, so it's always on.
  markerLayer = L.markerClusterGroup({ iconCreateFunction: clusterIcon })
  for (const location of props.locations) {
    markerLayer.addLayer(markerFor(location))
  }
  markerLayer.addTo(map)
}

// Clickable Mapy.com logo pinned over the map, as their terms require whenever
// their tiles are on screen. Added and removed with the layer itself, so it is
// never shown while OpenStreetMap is active.
function mapyLogoControl(): L.Control {
  // Bottom-right sits directly above the attribution text and clear of the
  // location panel, which MapView overlays on the bottom-left corner.
  const control = new L.Control({ position: 'bottomright' })
  control.onAdd = (): HTMLElement => {
    // `leaflet-control` is what makes the link clickable — Leaflet sets
    // `pointer-events: none` on the corner containers themselves.
    const link = L.DomUtil.create('a', 'leaflet-control')
    link.href = 'https://mapy.com/'
    link.target = '_blank'
    link.rel = 'noopener'
    link.title = 'Mapy.com'
    link.classList.add('block', 'rounded', 'bg-white/80', 'p-1', 'shadow')
    const logo = L.DomUtil.create('img', '', link)
    logo.src = MAPY_LOGO_URL
    logo.alt = 'Mapy.com'
    logo.style.height = `${MAPY_LOGO_HEIGHT_PX}px`
    logo.style.display = 'block'
    // Otherwise clicking the logo also drops a new-location pin underneath it.
    L.DomEvent.disableClickPropagation(link)
    return link
  }
  return control
}

function showMapyLogo(visible: boolean): void {
  if (!map) return
  if (visible && !mapyLogo) {
    mapyLogo = mapyLogoControl().addTo(map)
  } else if (!visible && mapyLogo) {
    mapyLogo.remove()
    mapyLogo = null
  }
}

// Draws whichever base layer the store selects, keeping the Mapy.com logo in
// step. Falls back to OSM whenever the Mapy layer does not exist (no key
// configured) without rewriting the stored preference, so a saved "mapy"
// choice applies again once a key returns.
//
// The switcher itself is a button group in MapView rather than Leaflet's own
// layers control: the map's other toggles are built that way, and Leaflet's
// expands on hover into the space those toggles occupy.
function applyBaseLayer(): void {
  if (!map || !osmLayer) return

  const next: L.TileLayer =
    (baseLayer.baseLayer === 'mapy' ? mapyLayer : null) ?? osmLayer
  const previous = next === osmLayer ? mapyLayer : osmLayer

  // Add before removing so no frame renders without a base layer.
  if (!map.hasLayer(next)) next.addTo(map)
  if (previous && map.hasLayer(previous)) map.removeLayer(previous)
  showMapyLogo(next === mapyLayer)
}

// Builds the Mapy.com tile layer. Only called once a key is known to exist —
// with no key the map simply never gains a second base layer.
function addMapyTileLayer(apiKey: string): void {
  if (!map || mapyLayer) return

  mapyLayer = L.tileLayer(
    `${MAPY_TILE_URL}?apikey=${encodeURIComponent(apiKey)}`,
    { maxZoom: MAPY_MAX_ZOOM, attribution: MAPY_ATTRIBUTION },
  )
  applyBaseLayer()
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

  osmLayer = L.tileLayer(OSM_TILE_URL, {
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

  // The key lives in the backend's environment. On the first mount it arrives
  // after this point and the watcher below wires the layer up; on a remount
  // (e.g. toggling back from the globe) the store already has it.
  if (config.mapyApiKey) addMapyTileLayer(config.mapyApiKey)
  void config.load().catch(() => undefined)
})

watch(() => props.locations, renderMarkers)

watch(
  () => config.mapyApiKey,
  (apiKey) => {
    if (apiKey) addMapyTileLayer(apiKey)
  },
)

watch(() => baseLayer.baseLayer, applyBaseLayer)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  // Disposes the tile layers, the layers control and the logo control with it.
  map?.remove()
  map = null
  markerLayer = null
  osmLayer = null
  mapyLayer = null
  mapyLogo = null
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
