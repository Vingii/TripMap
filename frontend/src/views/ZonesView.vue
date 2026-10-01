<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ZoneCanvas from '../components/ZoneCanvas.vue'
import ZoneGlobeCanvas from '../components/ZoneGlobeCanvas.vue'
import ZonePanel from '../components/ZonePanel.vue'
import { useConfigStore } from '../stores/config'
import { useLocationsStore } from '../stores/locations'
import { isMapFilter, useMapFilterStore } from '../stores/mapFilter'
import { useProjectionStore } from '../stores/projection'
import {
  useZonesStore,
  zoneFeatures,
  type ZoneFeatureCollection,
  type ZoneInfo,
} from '../stores/zones'
import type { Location } from '../api/locations'

const store = useLocationsStore()
const zones = useZonesStore()
const config = useConfigStore()
const mapFilter = useMapFilterStore()
const projection = useProjectionStore()
const route = useRoute()
const router = useRouter()

const EMPTY: ZoneFeatureCollection = { type: 'FeatureCollection', features: [] }

// Per-country clicks, layered over the instance's always-expanded countries:
// true splits a country into subdivisions, false merges it back — so a
// configured country can be collapsed too. Session-only by design.
const toggled = ref(new Map<string, boolean>())

const expanded = computed<ReadonlySet<string>>(() => {
  const result = new Set(config.zoneSubdivisionCountries)
  for (const [country, split] of toggled.value) {
    if (split) result.add(country)
    else result.delete(country)
  }
  return result
})

// Same per-user "visited" scoping as the pin view.
const displayLocations = computed<Location[]>(() =>
  mapFilter.filter === 'visited'
    ? store.locations.filter((l) => l.visited)
    : store.locations,
)

const features = computed<ZoneFeatureCollection>(() =>
  zones.countries
    ? zoneFeatures(
        zones.countries,
        zones.subdivisions,
        displayLocations.value,
        expanded.value,
      )
    : EMPTY,
)

const hovered = shallowRef<ZoneInfo | null>(null)

// The hover panel lives in a corner, out of the way of the pointer. Should the
// pointer stray into that corner it hops to the opposite one, so it never hides
// the zone being described.
type Corner = 'bottom-right' | 'top-left'
const corner = ref<Corner>('bottom-right')
const panelEl = useTemplateRef<HTMLDivElement>('panel')
const PANEL_MARGIN = 16

function onPointerMove(event: PointerEvent): void {
  const rect = panelEl.value?.getBoundingClientRect()
  if (!rect) return
  const near =
    event.clientX >= rect.left - PANEL_MARGIN &&
    event.clientX <= rect.right + PANEL_MARGIN &&
    event.clientY >= rect.top - PANEL_MARGIN &&
    event.clientY <= rect.bottom + PANEL_MARGIN
  if (near) {
    corner.value = corner.value === 'bottom-right' ? 'top-left' : 'bottom-right'
  }
}

onMounted(() => {
  void store.fetchAll()
  void config.load().catch(() => undefined)
  // Subdivisions are needed up front: they decide which countries can be
  // clicked at all, and configured countries start out expanded.
  void zones.load('country').then(() => zones.load('subdivision'))
  if (isMapFilter(route.query.filter)) {
    mapFilter.set(route.query.filter)
  }
})

// Keep the `filter` query param in sync for shareability; drop it when "all".
watch(
  () => mapFilter.filter,
  (filter) => {
    void router.replace({
      query: { ...route.query, filter: filter === 'all' ? undefined : filter },
    })
  },
)

function onZoneClick(zone: ZoneInfo): void {
  if (!zone.clickable || !zone.country) return
  const next = new Map(toggled.value)
  next.set(zone.country, zone.level === 'country')
  toggled.value = next
}
</script>

<template>
  <div class="relative h-full w-full" @pointermove="onPointerMove">
    <zone-canvas
      v-if="projection.projection === 'flat'"
      :zones="features"
      :borders="zones.countries"
      @zone-click="onZoneClick"
      @zone-hover="hovered = $event"
    />
    <zone-globe-canvas
      v-else
      :zones="features"
      :borders="zones.countries"
      @zone-click="onZoneClick"
      @zone-hover="hovered = $event"
    />

    <div
      class="absolute top-4 right-16 z-[1000] inline-flex overflow-hidden rounded-md border border-slate-300 bg-white text-sm font-medium shadow-sm dark:border-slate-600 dark:bg-slate-800"
    >
      <button
        type="button"
        class="px-3 py-2"
        :class="
          mapFilter.filter === 'all'
            ? 'bg-indigo-600 text-white'
            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700'
        "
        @click="mapFilter.set('all')"
      >
        All
      </button>
      <button
        type="button"
        class="px-3 py-2"
        :class="
          mapFilter.filter === 'visited'
            ? 'bg-indigo-600 text-white'
            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700'
        "
        @click="mapFilter.set('visited')"
      >
        My visited
      </button>
    </div>

    <div
      class="absolute top-16 right-16 z-[1000] inline-flex overflow-hidden rounded-md border border-slate-300 bg-white text-sm font-medium shadow-sm dark:border-slate-600 dark:bg-slate-800"
    >
      <button
        type="button"
        class="px-3 py-2"
        :class="
          projection.projection === 'flat'
            ? 'bg-indigo-600 text-white'
            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700'
        "
        @click="projection.set('flat')"
      >
        Flat
      </button>
      <button
        type="button"
        class="px-3 py-2"
        :class="
          projection.projection === 'globe'
            ? 'bg-indigo-600 text-white'
            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700'
        "
        @click="projection.set('globe')"
      >
        Globe
      </button>
    </div>

    <!-- Purely informational: never intercepts the pointer, so dragging and
         rotating work the same wherever the cursor is. -->
    <div
      v-if="hovered"
      ref="panel"
      class="pointer-events-none absolute z-[1000]"
      :class="corner === 'bottom-right' ? 'right-4 bottom-4' : 'top-4 left-4'"
    >
      <zone-panel :zone="hovered" />
    </div>

    <p
      v-if="zones.loading"
      class="absolute bottom-4 left-4 z-[1000] rounded-md bg-white/90 px-3 py-2 text-sm text-slate-600 shadow dark:bg-slate-800/90 dark:text-slate-300"
    >
      Loading map geometry…
    </p>
    <p
      v-else-if="zones.error"
      class="absolute bottom-4 left-4 z-[1500] rounded-md bg-red-600 px-3 py-2 text-sm text-white shadow"
    >
      {{ zones.error }}
    </p>
  </div>
</template>
