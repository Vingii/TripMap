<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ZoneCanvas from '../components/ZoneCanvas.vue'
import ZoneGlobeCanvas from '../components/ZoneGlobeCanvas.vue'
import { useLocationsStore } from '../stores/locations'
import { isMapFilter, useMapFilterStore } from '../stores/mapFilter'
import { useProjectionStore } from '../stores/projection'
import {
  countryZones,
  subdivisionZones,
  useZonesStore,
  type ZoneFeatureCollection,
  type ZoneInfo,
} from '../stores/zones'
import type { Location } from '../api/locations'

const store = useLocationsStore()
const zones = useZonesStore()
const mapFilter = useMapFilterStore()
const projection = useProjectionStore()
const route = useRoute()
const router = useRouter()

const EMPTY: ZoneFeatureCollection = { type: 'FeatureCollection', features: [] }

/** The country we are drilled into, taken from the URL so Back just works. */
const selectedCountry = computed<string | null>(() => {
  const value = route.query.country
  return typeof value === 'string' && value ? value : null
})

// Same per-user "visited" scoping as the pin view.
const displayLocations = computed<Location[]>(() =>
  mapFilter.filter === 'visited'
    ? store.locations.filter((l) => l.visited)
    : store.locations,
)

const features = computed<ZoneFeatureCollection>(() => {
  const country = selectedCountry.value
  if (country) {
    return zones.subdivisions
      ? subdivisionZones(zones.subdivisions, displayLocations.value, country)
      : EMPTY
  }
  return zones.countries
    ? countryZones(zones.countries, displayLocations.value)
    : EMPTY
})

const selectedCountryName = computed<string | null>(() => {
  const country = selectedCountry.value
  if (!country || !zones.countries) return null
  const match = zones.countries.features.find(
    (f) => f.properties.country_code === country,
  )
  return match?.properties.name ?? country
})

onMounted(() => {
  void store.fetchAll()
  void zones.load('country')
  if (isMapFilter(route.query.filter)) {
    mapFilter.set(route.query.filter)
  }
})

// The 1.7 MB subdivision layer is only worth fetching once a country is opened.
watch(
  selectedCountry,
  (country) => {
    if (country) void zones.load('subdivision')
  },
  { immediate: true },
)

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
  // Only countries drill down, and only when there is something to show.
  if (selectedCountry.value || zone.count === 0) return
  void router.push({ query: { ...route.query, country: zone.key } })
}

function toWorld(): void {
  if (!selectedCountry.value) return
  void router.push({ query: { ...route.query, country: undefined } })
}
</script>

<template>
  <div class="relative h-full w-full">
    <zone-canvas
      v-if="projection.projection === 'flat'"
      :zones="features"
      :focus-key="selectedCountry"
      @zone-click="onZoneClick"
      @background="toWorld"
    />
    <zone-globe-canvas
      v-else
      :zones="features"
      :focus-key="selectedCountry"
      @zone-click="onZoneClick"
      @background="toWorld"
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

    <button
      v-if="selectedCountry"
      type="button"
      class="absolute top-4 left-4 z-[1000] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      @click="toWorld"
    >
      ← {{ selectedCountryName }}
    </button>

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
