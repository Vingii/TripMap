<script setup lang="ts">
import { onMounted, reactive, ref, useTemplateRef } from 'vue'
import MapCanvas from '../components/MapCanvas.vue'
import LocationSearch from '../components/LocationSearch.vue'
import LocationForm from '../components/LocationForm.vue'
import LocationPanel from '../components/LocationPanel.vue'
import { useLocationsStore } from '../stores/locations'
import type { Location } from '../api/locations'
import type { GeocodeResult } from '../api/geocode'

const store = useLocationsStore()
const mapRef = useTemplateRef<InstanceType<typeof MapCanvas>>('map')

const selected = ref<Location | null>(null)
const actionError = ref<string | null>(null)

interface FormState {
  open: boolean
  mode: 'create' | 'edit'
  id: string | null
  name: string
  lat: number | null
  lng: number | null
  // Carried from a name-search match so the backend can skip a reverse lookup.
  countryCode: string | null
}

const form = reactive<FormState>({
  open: false,
  mode: 'create',
  id: null,
  name: '',
  lat: null,
  lng: null,
  countryCode: null,
})

onMounted(() => {
  void store.fetchAll()
})

function openCreate(
  name: string,
  lat: number | null,
  lng: number | null,
): void {
  selected.value = null
  Object.assign(form, {
    open: true,
    mode: 'create',
    id: null,
    name,
    lat,
    lng,
    countryCode: null,
  })
}

// Map click → create with coordinates pre-filled; the server reverse-geocodes.
function onMapClick(coords: { lat: number; lng: number }): void {
  openCreate('', coords.lat, coords.lng)
}

// "Add location" → create with empty manual-entry fields.
function onAddManual(): void {
  openCreate('', null, null)
}

// Name search → fly to the match and open create pre-filled from it.
function onSearchSelect(place: GeocodeResult): void {
  mapRef.value?.flyToPlace(place.lat, place.lng, place.bounding_box)
  openCreate(place.name, place.lat, place.lng)
  form.countryCode = place.country_code
}

function onMarkerClick(location: Location): void {
  form.open = false
  selected.value = location
}

function onEdit(): void {
  if (!selected.value) return
  const location = selected.value
  Object.assign(form, {
    open: true,
    mode: 'edit',
    id: location.id,
    name: location.name,
    lat: location.lat,
    lng: location.lng,
    countryCode: null,
  })
  selected.value = null
}

async function onSubmit(payload: {
  name: string
  lat: number
  lng: number
}): Promise<void> {
  actionError.value = null
  try {
    if (form.mode === 'edit' && form.id) {
      const updated = await store.update(form.id, payload)
      if (selected.value?.id === updated.id) selected.value = updated
    } else {
      // Reuse the search's country code only when the coordinates are unchanged.
      const unchanged = payload.lat === form.lat && payload.lng === form.lng
      await store.create({
        ...payload,
        ...(unchanged && form.countryCode
          ? { country_code: form.countryCode }
          : {}),
      })
    }
    form.open = false
  } catch {
    actionError.value = 'Could not save the location. Please try again.'
  }
}

async function onDelete(): Promise<void> {
  if (!selected.value) return
  actionError.value = null
  try {
    await store.remove(selected.value.id)
    selected.value = null
  } catch {
    actionError.value = 'Could not delete the location. Please try again.'
  }
}
</script>

<template>
  <div class="relative h-full w-full">
    <map-canvas
      ref="map"
      :locations="store.locations"
      @map-click="onMapClick"
      @marker-click="onMarkerClick"
    />

    <div class="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
      <location-search @select="onSearchSelect" />
      <button
        type="button"
        class="self-start rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        @click="onAddManual"
      >
        + Add location
      </button>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        …or click the map to drop a pin.
      </p>
    </div>

    <div
      v-if="actionError"
      class="absolute top-4 left-1/2 z-[1500] -translate-x-1/2 rounded-md bg-red-600 px-4 py-2 text-sm text-white shadow-lg"
    >
      {{ actionError }}
    </div>

    <div v-if="selected" class="absolute bottom-6 left-4 z-[1000]">
      <location-panel
        :location="selected"
        @edit="onEdit"
        @delete="onDelete"
        @close="selected = null"
      />
    </div>

    <location-form
      v-if="form.open"
      :title="form.mode === 'edit' ? 'Edit location' : 'New location'"
      :name="form.name"
      :lat="form.lat"
      :lng="form.lng"
      :submit-label="form.mode === 'edit' ? 'Save changes' : 'Create'"
      @submit="onSubmit"
      @cancel="form.open = false"
    />
  </div>
</template>
