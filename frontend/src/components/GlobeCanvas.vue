<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { GeoJSONSource, StyleSpecification } from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import { useMapStore } from '../stores/map'
import type { Location } from '../api/locations'
import type { BoundingBox } from '../api/geocode'

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

let map: maplibregl.Map | null = null
let resizeObserver: ResizeObserver | null = null

// HTML markers keyed by a stable id ('c<cluster_id>' / 'p<location_id>'); only
// the subset currently in view is attached to the map at any time.
const markers: Record<string, maplibregl.Marker> = {}
let markersOnScreen: Record<string, maplibregl.Marker> = {}

const MARKER_COLOR = '#6366f1'
const SOURCE_ID = 'locations'

// Same teardrop pin as the flat map (24×36, tip at 12,36): visited pins are
// filled solid, unvisited ones a hollow outline.
function pinSvg(visited: boolean): string {
  const fill = visited ? MARKER_COLOR : '#ffffff'
  const stroke = visited ? '#1e293b' : MARKER_COLOR
  const dot = visited ? '#ffffff' : MARKER_COLOR
  return `
    <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0Z"
            fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="${dot}"/>
    </svg>`
}

function pinElement(location: Location): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = pinSvg(location.visited)
  el.title = location.name
  el.style.cursor = 'pointer'
  el.addEventListener('click', (event) => {
    // Keep the click off the map so it doesn't also open the "new location"
    // form behind the pin we actually clicked.
    event.stopPropagation()
    emit('markerClick', location)
  })
  return el
}

// Cluster bubble styled like the flat map's: filled blue when any child is
// visited, otherwise a hollow white circle with a blue outline.
function clusterElement(count: number, anyVisited: boolean): HTMLElement {
  const bg = anyVisited ? MARKER_COLOR : '#ffffff'
  const fg = anyVisited ? '#ffffff' : MARKER_COLOR
  const border = anyVisited ? '#1e293b' : MARKER_COLOR
  const el = document.createElement('div')
  el.style.cssText = `display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px;background:${bg};color:${fg};border:2px solid ${border};font:600 13px/1 system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer;`
  el.textContent = String(count)
  return el
}

function toGeoJSON(locations: Location[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: locations.map((l) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
      // `visited` is a 0/1 number so the cluster can aggregate it with `max`.
      properties: { id: l.id, name: l.name, visited: l.visited ? 1 : 0 },
    })),
  }
}

interface ClusterProps {
  cluster: boolean
  cluster_id: number
  point_count: number
  point_count_abbreviated: string
  anyVisited: number
}

// Reconcile the in-view source features (clusters + lone points) with the HTML
// markers on screen — the standard maplibre approach to clustering DOM markers.
function updateMarkers(): void {
  if (!map) return
  const byId = new Map(props.locations.map((l) => [l.id, l]))
  const next: Record<string, maplibregl.Marker> = {}
  for (const feature of map.querySourceFeatures(SOURCE_ID)) {
    const coords = (feature.geometry as Point).coordinates as [number, number]
    const raw = feature.properties ?? {}

    if (raw.cluster) {
      const props = raw as unknown as ClusterProps
      const id = `c${props.cluster_id}`
      let marker = markers[id]
      if (!marker) {
        const el = clusterElement(props.point_count, props.anyVisited > 0)
        el.addEventListener('click', () => {
          const source = map?.getSource(SOURCE_ID) as GeoJSONSource | undefined
          void source
            ?.getClusterExpansionZoom(props.cluster_id)
            .then((zoom) => {
              map?.easeTo({ center: coords, zoom })
            })
        })
        marker = markers[id] = new maplibregl.Marker({ element: el }).setLngLat(
          coords,
        )
      }
      next[id] = marker
      if (!markersOnScreen[id]) marker.addTo(map)
    } else {
      const location = byId.get(raw.id as string)
      if (!location) continue
      const id = `p${location.id}`
      let marker = markers[id]
      if (!marker) {
        marker = markers[id] = new maplibregl.Marker({
          element: pinElement(location),
          anchor: 'bottom',
        }).setLngLat(coords)
      }
      next[id] = marker
      if (!markersOnScreen[id]) marker.addTo(map)
    }
  }
  for (const id in markersOnScreen) {
    if (!next[id]) markersOnScreen[id].remove()
  }
  markersOnScreen = next
}

// Push fresh location data into the source and drop the cached markers so they
// rebuild — cluster ids and visited colours can both change on a data update.
function setData(): void {
  const source = map?.getSource(SOURCE_ID) as GeoJSONSource | undefined
  if (!source) return
  for (const id in markers) {
    markers[id].remove()
    delete markers[id]
  }
  markersOnScreen = {}
  source.setData(toGeoJSON(props.locations))
}

onMounted(() => {
  if (!containerEl.value) return

  const style: StyleSpecification = {
    version: 8,
    // Globe projection draws the world as a sphere; drag rotates it and scroll
    // zooms, both on by default. It has to be part of the initial style — a
    // post-construction setProjection() runs before the style loads and is lost.
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
    // The shared map store keeps coordinates in Leaflet's [lat, lng] order;
    // maplibre wants [lng, lat].
    center: [store.center[1], store.center[0]],
    zoom: store.zoom,
    attributionControl: { compact: false },
  })
  map.addControl(new maplibregl.NavigationControl(), 'top-right')

  map.on('load', () => {
    if (!map) return
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: toGeoJSON(props.locations),
      cluster: true,
      clusterRadius: 50,
      clusterMaxZoom: 14,
      // Tracks whether any clustered point is visited, to colour the bubble.
      clusterProperties: { anyVisited: ['max', ['get', 'visited']] },
    })
    // The pins are HTML markers, but maplibre only tiles a source that at least
    // one layer references — without this invisible layer querySourceFeatures()
    // returns nothing. It also forces the cluster index to build.
    map.addLayer({
      id: `${SOURCE_ID}-anchor`,
      type: 'circle',
      source: SOURCE_ID,
      paint: { 'circle-radius': 0, 'circle-opacity': 0 },
    })
  })

  // querySourceFeatures only returns data once the source's tiles are loaded;
  // re-derive the markers on every frame so they track pan, zoom, and rotation.
  map.on('render', () => {
    if (!map?.getSource(SOURCE_ID) || !map.isSourceLoaded(SOURCE_ID)) return
    updateMarkers()
  })

  map.on('click', (event) => {
    emit('mapClick', { lat: event.lngLat.lat, lng: event.lngLat.lng })
  })

  const persist = (): void => {
    if (!map) return
    const c = map.getCenter()
    store.setView({ center: [c.lat, c.lng], zoom: map.getZoom() })
  }
  map.on('moveend', persist)

  resizeObserver = new ResizeObserver(() => map?.resize())
  resizeObserver.observe(containerEl.value)
})

watch(() => props.locations, setData)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  map?.remove()
  map = null
  markersOnScreen = {}
})

// Fallback zoom for the rare result that carries no bounding box.
const FALLBACK_ZOOM = 11

function flyToPlace(
  lat: number,
  lng: number,
  bounds: BoundingBox | null,
): void {
  if (!map) return
  if (bounds) {
    map.fitBounds([
      [bounds.west, bounds.south],
      [bounds.east, bounds.north],
    ])
  } else {
    map.flyTo({ center: [lng, lat], zoom: FALLBACK_ZOOM })
  }
}

defineExpose({ flyToPlace })
</script>

<template>
  <div ref="container" class="h-full w-full" />
</template>
